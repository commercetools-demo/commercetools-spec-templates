/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Turn one collector response row into answers keyed by field id.
//
// Answers arrive as a CSV export of the Google Form's responses sheet. The sheet's column headers
// are the question titles, so the export carries the LABEL and never the field id.
// `collector/forms/form-map-v<n>.json` is what maps a header back to a field id, and old versions
// are kept so a response filed against an earlier form still maps.
//
// One form serves every industry, so which industry a response is about is itself one of these
// answers — see `industry_field` and `industry_options` in the map.
//
// The one genuinely dangerous detail: a checkbox question exports its selected values as a single
// cell joined with ", ", and an option's own label may contain a comma. Splitting on the separator
// silently turns one answer into several wrong ones, so the values are recovered by matching
// against the recorded option list instead. That is `splitMultiSelect`, and it is why the form map
// records `options`.

const NO_RESPONSE = "_No response_";

/** Lossy key for recovering from a respondent editing a heading (case, spacing, trailing colon). */
const loose = (s) => s.toLowerCase().replace(/\s+/g, " ").replace(/[\s:.,!?]+$/, "").trim();

/**
 * Split a multi-select line into option values without ever splitting on the separator.
 * Consumes the longest matching option at each step; the separator is only consumed BETWEEN
 * matches, so an option containing ", " survives intact.
 * @returns {{values: string[], exact: boolean}} exact=false means we fell back and the record
 *          should be flagged for a human rather than trusted.
 */
export function splitMultiSelect(line, options) {
  if (!options?.length) return { values: line.split(", ").filter(Boolean), exact: false };
  const byLongest = [...options].sort((a, b) => b.length - a.length);
  const values = [];
  let rest = line;
  while (rest.length) {
    const hit = byLongest.find((o) => rest.startsWith(o));
    if (!hit) return { values: line.split(", ").filter(Boolean), exact: false };
    values.push(hit);
    rest = rest.slice(hit.length);
    if (rest.startsWith(", ")) rest = rest.slice(2);
    else if (rest.length) return { values: line.split(", ").filter(Boolean), exact: false };
  }
  return { values, exact: true };
}


/** A header we could not attribute to any field in any known map version. */
const UNMAPPED = Symbol("unmapped");

/**
 * @param {Record<string,string>} row one CSV record, keyed by column header
 * @param {{fields: {label:string,id:string,type:string,multiple:boolean,options:string[]|null,
 *          max_length:number|null,required:boolean}[]}} map the form map for this questionnaire version
 * @returns {{answers: Record<string, any>, report: object}}
 */
export function mapResponse(row, map) {
  const report = {
    map_version: map.map_version,
    questionnaire_version: map.questionnaire_version,
    matched_fields: [],
    unmatched_expected_labels: [],
    unrecognised_columns: [],
    missing_required: [],
    over_length: [],
    unexpected_option_values: [],
    inexact_multiselect: [],
  };
  const answers = {};

  // Exact header match first, then a lossy one, so a hand-edited sheet header still lands.
  const byExact = new Map(Object.keys(row).map((h) => [h.trim(), h]));
  const byLoose = new Map(Object.keys(row).map((h) => [loose(h), h]));
  const used = new Set();

  for (const f of map.fields) {
    const header = byExact.get(f.label.trim()) ?? byLoose.get(loose(f.label));
    if (header === undefined) { report.unmatched_expected_labels.push(f.label); answers[f.id] = null; continue; }
    used.add(header);
    report.matched_fields.push(f.id ?? f.label);

    const cell = String(row[header] ?? "").trim();
    if (cell === "") {
      answers[f.id] = null;
      if (f.required) report.missing_required.push(f.id);
      continue;
    }

    if (f.multiple) {
      const { values, exact } = splitMultiSelect(cell, f.options);
      if (!exact) report.inexact_multiselect.push(f.id);
      const unknown = values.filter((v) => f.options && !f.options.includes(v));
      if (unknown.length) report.unexpected_option_values.push({ field: f.id, values: unknown });
      answers[f.id] = values;
      continue;
    }
    // Validate on the PRESENCE of an option list, never on a type name. Keying this on
    // `type === "dropdown"` silently disabled it the moment the map started recording the
    // questionnaire's own type ("single") instead of a form platform's.
    if (f.options?.length) {
      if (!f.options.includes(cell)) {
        report.unexpected_option_values.push({ field: f.id, values: [cell] });
      }
      answers[f.id] = cell;
      continue;
    }
    if (f.max_length && cell.length > f.max_length) {
      report.over_length.push({ field: f.id, length: cell.length, limit: f.max_length });
    }
    answers[f.id] = cell;
  }

  // Columns Google adds itself (Timestamp, Email Address) are expected; anything else is reported
  // so a question added to the live form without regenerating the map cannot vanish unnoticed.
  const GOOGLE = new Set(["timestamp", "email address", "score"]);
  for (const h of Object.keys(row)) {
    if (used.has(h) || GOOGLE.has(loose(h)) || String(row[h] ?? "").trim() === "") continue;
    report.unrecognised_columns.push(h);
  }

  report.ok =
    report.unmatched_expected_labels.length === 0 &&
    report.unrecognised_columns.length === 0 &&
    report.missing_required.length === 0 &&
    report.inexact_multiselect.length === 0 &&
    report.unexpected_option_values.length === 0;

  return { answers, report };
}

export { UNMAPPED };
