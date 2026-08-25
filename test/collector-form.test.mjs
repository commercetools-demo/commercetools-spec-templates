// The generated Apps Script, executed.
//
// `lint` gate J proves collector/forms/*.gs PARSES. Parsing is not much: every bug this script
// has actually shipped was a runtime one — `getDestinationId()` throwing instead of returning
// null, `getFilesByName` handing back a trashed file — and the only place it runs is inside a
// Google account, which no test can reach.
//
// So the Forms, Drive and Sheets APIs are faked here, closely enough to reproduce the traps that
// bit us: the destination getter THROWS when unset, choice setters exist only on choice items,
// and Drive returns trashed files. The fake cannot prove the script works against Google. It can
// prove the branch that keeps a respondent's answers is the branch that runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(ROOT, "collector/forms/expert-intake.gs"), "utf8");
// Newest map version, never a hardcoded one: bumping the questionnaire must not need a test edit.
const MAP_FILE = fs.readdirSync(path.join(ROOT, "collector/forms"))
  .filter((f) => /^form-map-v\d+\.json$/.test(f))
  .sort((a, b) => Number(b.match(/v(\d+)/)[1]) - Number(a.match(/v(\d+)/)[1]))[0];
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "collector/forms", MAP_FILE), "utf8"));

// Enum members compared by identity, exactly as FormApp.ItemType is.
const TYPE = {};
for (const k of ["LIST", "MULTIPLE_CHOICE", "CHECKBOX", "TEXT", "PARAGRAPH_TEXT", "IMAGE"]) {
  TYPE[k] = { toString: () => k };
}
const CHOICE_KINDS = new Set(["LIST", "MULTIPLE_CHOICE", "CHECKBOX"]);

/** The item kind a questionnaire type must render as. The generated script's own mapping. */
const kindOf = (field) => ({ dropdown: "LIST", single: "MULTIPLE_CHOICE", multi: "CHECKBOX",
  short_text: "TEXT", long_text: "PARAGRAPH_TEXT" })[field.type];

class FakeItem {
  constructor(kind) {
    this.kind = kind;
    this.title = "";
    this.help = "";
    this.choices = null;
    this.required = false;
    if (CHOICE_KINDS.has(kind)) {
      // Only choice items have this method. A text item that is handed choices should blow up
      // here, the way ParagraphTextItem would.
      this.setChoiceValues = (v) => { this.choices = v.slice(); return this; };
    }
  }
  getType() { return TYPE[this.kind]; }
  setTitle(v) { this.title = v; return this; }
  setHelpText(v) { this.help = v; return this; }
  setRequired(v) { this.required = v; return this; }
  // getItems() returns generic Items: the cast is mandatory, and casting to the wrong type
  // throws in Apps Script rather than coercing.
  #as(kind) {
    if (this.kind !== kind) throw new Error(`cannot cast a ${this.kind} item to ${kind}`);
    return this;
  }
  asListItem() { return this.#as("LIST"); }
  asMultipleChoiceItem() { return this.#as("MULTIPLE_CHOICE"); }
  asCheckboxItem() { return this.#as("CHECKBOX"); }
  asTextItem() { return this.#as("TEXT"); }
  asParagraphTextItem() { return this.#as("PARAGRAPH_TEXT"); }
}

class FakeForm {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.description = "";
    this.items = [];
    this.destination = null;
    this.deleted = 0;      // how many items this run threw away
    this.added = 0;
  }
  setTitle(v) { this.title = v; return this; }
  setDescription(v) { this.description = v; return this; }
  setCollectEmail() { return this; }
  setLimitOneResponsePerUser() { return this; }
  setProgressBar() { return this; }
  getItems() { return this.items.slice(); }
  deleteItem(item) {
    const i = this.items.indexOf(item);
    if (i < 0) throw new Error("deleteItem: item is not on this form");
    this.items.splice(i, 1);
    this.deleted++;
  }
  #add(kind) { const it = new FakeItem(kind); this.items.push(it); this.added++; return it; }
  addListItem() { return this.#add("LIST"); }
  addMultipleChoiceItem() { return this.#add("MULTIPLE_CHOICE"); }
  addCheckboxItem() { return this.#add("CHECKBOX"); }
  addTextItem() { return this.#add("TEXT"); }
  addParagraphTextItem() { return this.#add("PARAGRAPH_TEXT"); }
  // The trap that shipped: this THROWS when nothing is linked. It does not return null.
  getDestinationId() {
    if (!this.destination) throw new Error("The form currently has no response destination.");
    return this.destination;
  }
  setDestination(_type, id) { this.destination = id; return this; }
  getPublishedUrl() { return `https://forms.example/${this.id}/viewform`; }
  getEditUrl() { return `https://forms.example/${this.id}/edit`; }
}

/** A Drive that survives between runs, so re-running `setup` is the real second run. */
function makeDrive() {
  const files = [];      // {name, mime, trashed, form}
  const sheets = new Map();
  return {
    files,
    sheets,
    put(name, { mime = "application/vnd.google-apps.form", trashed = false, form = null } = {}) {
      files.push({ name, mime, trashed, form });
      return form;
    },
    context(log) {
      return {
        MimeType: { GOOGLE_FORMS: "application/vnd.google-apps.form", GOOGLE_DOCS: "application/vnd.google-apps.document" },
        DriveApp: {
          getFilesByName(name) {
            const hits = files.filter((f) => f.name === name);
            let i = 0;
            return {
              hasNext: () => i < hits.length,
              next: () => {
                const f = hits[i++];
                return {
                  isTrashed: () => f.trashed,
                  getMimeType: () => f.mime,
                  getId: () => f.name + "::" + files.indexOf(f),
                };
              },
            };
          },
        },
        FormApp: {
          ItemType: TYPE,
          DestinationType: { SPREADSHEET: "SPREADSHEET" },
          create(title) {
            const form = new FakeForm("form" + files.length, title);
            files.push({ name: title, mime: "application/vnd.google-apps.form", trashed: false, form });
            return form;
          },
          openById(id) {
            const f = files[Number(String(id).split("::")[1])];
            if (!f?.form) throw new Error(`openById: ${id} is not a form`);
            return f.form;
          },
        },
        SpreadsheetApp: {
          create(name) {
            const id = "sheet" + sheets.size;
            sheets.set(id, name);
            return { getId: () => id, getUrl: () => `https://sheets.example/${id}` };
          },
          openById(id) {
            if (!sheets.has(id)) throw new Error(`openById: no sheet ${id}`);
            return { getUrl: () => `https://sheets.example/${id}` };
          },
        },
        Logger: { log: (m) => log.push(String(m)) },
      };
    },
  };
}

/** Run the generated script the way the editor's Run button does. */
function runSetup(drive, { source = SRC } = {}) {
  const log = [];
  const ctx = vm.createContext(drive.context(log));
  new vm.Script(source + "\nsetup();", { filename: "expert-intake.gs" }).runInContext(ctx);
  return { log, forms: drive.files.filter((f) => f.form).map((f) => f.form) };
}

// ---------------------------------------------------------------------------------------------

test("a first run builds the whole questionnaire and links a responses sheet", () => {
  const drive = makeDrive();
  const { log, forms } = runSetup(drive);

  assert.equal(forms.length, 1, "exactly one form");
  const form = forms[0];
  assert.equal(form.items.length, MAP.fields.length, "one item per form-map field");
  assert.equal(form.deleted, 0);
  assert.ok(form.destination, "a responses spreadsheet was linked");
  assert.ok(log.some((l) => l.includes("Responses sheet created")));
  assert.ok(log.some((l) => l.includes("/viewform")), "the published URL is logged");
});

test("the first question is a dropdown of every industry, and it is required", () => {
  const drive = makeDrive();
  const { forms } = runSetup(drive);
  const first = forms[0].items[0];

  assert.equal(first.kind, "LIST", "a select, not radio buttons");
  assert.equal(first.required, true);
  assert.equal(first.title, MAP.fields[0].label);
  // Every taxonomy industry is offered, plus the not-listed escape hatch.
  for (const label of Object.keys(MAP.industry_options)) {
    assert.ok(first.choices.includes(label), `${label} missing from the dropdown`);
  }
  assert.equal(first.choices.length, Object.keys(MAP.industry_options).length + 1);
});

test("items are built in the form map's order, so a sheet heading maps back to a field", () => {
  const drive = makeDrive();
  const { forms } = runSetup(drive);
  assert.deepEqual(forms[0].items.map((i) => i.title), MAP.fields.map((f) => f.label));
});

test("re-running updates in place and deletes nothing — response columns survive", () => {
  const drive = makeDrive();
  runSetup(drive);
  const form = drive.files[0].form;
  const itemsBefore = form.getItems();

  // Simulate the reason to re-run: a new industry, so the dropdown is short by one.
  form.items[0].choices = form.items[0].choices.slice(0, -1);
  form.added = 0;
  form.deleted = 0;

  const { log, forms } = runSetup(drive);
  assert.equal(forms.length, 1, "no second form was created");
  assert.equal(form.deleted, 0, "deleting an item orphans its column in the responses sheet");
  assert.equal(form.added, 0);
  assert.deepEqual(form.getItems(), itemsBefore, "the same item objects, updated");
  assert.equal(form.items[0].choices.length, Object.keys(MAP.industry_options).length + 1,
    "the dropdown was brought back up to date");
  assert.ok(log.some((l) => l.includes("in place")));
});

test("re-running does not create a second responses sheet", () => {
  const drive = makeDrive();
  runSetup(drive);
  const { log } = runSetup(drive);
  assert.equal(drive.sheets.size, 1);
  assert.ok(log.some((l) => l.includes("Responses sheet: ")), "it reports the existing one");
  assert.ok(!log.some((l) => l.includes("created")));
});

test("a changed questionnaire shape rebuilds, and says what that costs", () => {
  const drive = makeDrive();
  runSetup(drive);
  const form = drive.files[0].form;
  form.items.pop();               // as if a question had been added to the questionnaire
  form.added = 0;
  form.deleted = 0;

  const { log } = runSetup(drive);
  assert.equal(form.deleted, MAP.fields.length - 1);
  assert.equal(form.added, MAP.fields.length);
  assert.equal(form.items.length, MAP.fields.length);
  assert.ok(log.some((l) => l.includes("shape changed")), "the rebuild is not silent");
  assert.ok(log.some((l) => l.includes("empty columns")), "and it says what it costs");
});

test("a same-kind form whose questions were reordered still rebuilds rather than mislabelling", () => {
  const drive = makeDrive();
  runSetup(drive);
  const form = drive.files[0].form;
  // Swap the dropdown and a paragraph question: same count, different kinds per position.
  [form.items[0], form.items[2]] = [form.items[2], form.items[0]];
  form.added = 0;
  form.deleted = 0;

  runSetup(drive);
  assert.equal(form.added, MAP.fields.length, "kinds no longer line up, so it starts over");
  assert.deepEqual(form.items.map((i) => i.kind), MAP.fields.map(kindOf),
    "and puts them back in the questionnaire's order");
});

test("a trashed form of the same name is not resurrected from the bin", () => {
  const drive = makeDrive();
  const trashed = new FakeForm("old", "commercetools spec collector — industry intake");
  drive.put("commercetools spec collector — industry intake", { trashed: true, form: trashed });

  const { forms } = runSetup(drive);
  assert.equal(forms.length, 2, "the trashed one plus a fresh one");
  assert.equal(trashed.items.length, 0, "the deleted form was left deleted");
  assert.equal(forms[1].items.length, MAP.fields.length);
});

test("a document sharing the form's name does not crash openById", () => {
  const drive = makeDrive();
  drive.put("commercetools spec collector — industry intake",
    { mime: "application/vnd.google-apps.document" });

  const { forms } = runSetup(drive);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].items.length, MAP.fields.length);
});
