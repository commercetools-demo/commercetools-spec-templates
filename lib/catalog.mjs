// Loads the authored YAML into one plain catalog object. Used ONLY by ctsx (the authoring tool),
// which is why `yaml` is a devDependency: the shipped `cts` engine reads generated JSON and has
// zero runtime dependencies.

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const read = (p) => YAML.parse(fs.readFileSync(p, "utf8"));

const listYaml = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort().map((f) => path.join(dir, f))
    : [];

export function loadCatalog(root = process.cwd()) {
  const industries = read(path.join(root, "taxonomy/industries.yaml"));
  const models = read(path.join(root, "taxonomy/business-models.yaml"));
  const domains = read(path.join(root, "taxonomy/domains.yaml"));
  const skills = read(path.join(root, "taxonomy/skills.yaml"));
  const epics = read(path.join(root, "taxonomy/epics.yaml"));
  const journeys = read(path.join(root, "taxonomy/journeys.yaml"));
  const meta = read(path.join(root, "catalog/catalog.yaml"));

  const capabilities = [];
  const sources = {};
  const verticals = {};

  const verticalsDir = path.join(root, "catalog/verticals");
  for (const id of fs.existsSync(verticalsDir) ? fs.readdirSync(verticalsDir).sort() : []) {
    const vdir = path.join(verticalsDir, id);
    if (!fs.statSync(vdir).isDirectory()) continue;
    verticals[id] = read(path.join(vdir, "vertical.yaml"));
    for (const f of listYaml(path.join(vdir, "capabilities"))) {
      capabilities.push({ ...read(f), _file: path.relative(root, f) });
    }
    for (const f of listYaml(path.join(vdir, "sources"))) {
      const rec = read(f);
      sources[rec.id] = { ...rec, _file: path.relative(root, f) };
    }
  }
  // Every subdirectory, plus loose files. The subdirectory names (shared/, b2c/, b2b/, ...) are
  // filing only: what a capability applies to is its own `business_models`, never its folder.
  // This used to be a hardcoded ["shared","b2c","b2b"], which meant a new folder — b2b2c/ being
  // the obvious one to reach for — was silently skipped: the capabilities simply never loaded,
  // and nothing failed to say so.
  const commonDir = path.join(root, "catalog/common/capabilities");
  const commonSubs = fs.existsSync(commonDir)
    ? fs.readdirSync(commonDir, { withFileTypes: true })
        .filter((e) => e.isDirectory()).map((e) => e.name).sort()
    : [];
  for (const dir of [commonDir, ...commonSubs.map((sub) => path.join(commonDir, sub))]) {
    for (const f of listYaml(dir)) {
      capabilities.push({ ...read(f), _file: path.relative(root, f) });
    }
  }
  // Rights records for documents that source the industry-agnostic base.
  for (const f of listYaml(path.join(root, "catalog/common/sources"))) {
    const rec = read(f);
    sources[rec.id] = { ...rec, _file: path.relative(root, f) };
  }

  return {
    meta,
    industry_groups: industries.groups,
    industries: industries.industries,
    business_models: models.business_models,
    global_epics: epics.epics,
    journeys: journeys.journeys,
    domains: domains.domains,
    skills: skills.skills,
    verticals,
    sources,
    capabilities,
  };
}

export function loadQuestionnaire(root, id) {
  return read(path.join(root, "questions", `${id}.yaml`));
}
