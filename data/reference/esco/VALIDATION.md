# ESCO v1.2.1 English CSV — Stage 2 validation

Inspected on 28 October 2026. Counts below were computed from the extracted files, not estimated.

## Archive

- Exact filename: `ESCO dataset - v1.2.1 - classification - en - csv.zip`
- Path: `data/reference/esco/original/ESCO dataset - v1.2.1 - classification - en - csv.zip`
- Size: 10,045,670 bytes
- File last write (local): 2026-10-28 00:25:10
- SHA-256: `f9761b0b52be1828b38a3e5e0ae59a93a7b0ce358bc800f52f57a8b002adeb3e`
- Zip entries: 19 CSV files (listed before extraction)

Expected core files were present in the archive:

- `occupations_en.csv`
- `skills_en.csv`
- `occupationSkillRelations_en.csv`

Extracted without overwrite to:

`data/reference/esco/extracted/v1.2.1-classification-en-csv/`

## Official source, version, licence

- Source: https://esco.ec.europa.eu/en/use-esco/download
- Version (from official package name): ESCO dataset v1.2.1, classification, English, CSV
- Licence: Commission Decision 2011/833/EU (reuse of Commission documents). ESCO FAQ: download, use, reproduce and reuse free of charge; acknowledge ESCO; mark modified versions.
- Attribution for applications: `This service uses the ESCO classification of the European Commission.`
- Attribution for reports: `This publication uses the ESCO classification of the European Commission.`

## Headers (actual)

**occupations_en.csv:** conceptType, conceptUri, iscoGroup, preferredLabel, altLabels, hiddenLabels, status, modifiedDate, regulatedProfessionNote, scopeNote, definition, inScheme, description, code, naceCode

Identifiers: `conceptUri`. Labels: `preferredLabel`. Occupation–ISCO: `iscoGroup`.

**skills_en.csv:** conceptType, conceptUri, skillType, reuseLevel, preferredLabel, altLabels, hiddenLabels, status, modifiedDate, scopeNote, definition, inScheme, description

Identifiers: `conceptUri`. Labels: `preferredLabel`.

**occupationSkillRelations_en.csv:** occupationUri, occupationLabel, relationType, skillType, skillUri, skillLabel

Occupation–skill links: `occupationUri` + `skillUri`. Relation: `relationType` (`essential` / `optional`).

## Record counts (data rows, excluding header)

| File | Rows | Unique conceptUri |
|---|---|---|
| occupations_en.csv | 3043 | 3039 |
| skills_en.csv | 13960 | 13939 |
| occupationSkillRelations_en.csv | 126051 | n/a |
| ISCOGroups_en.csv | 619 | — |
| skillGroups_en.csv | 640 | — |

Occupation–skill relations: 67,600 essential, 58,451 optional.

All occupation and skill rows have status `released`. No empty `conceptUri` or `preferredLabel` on occupations or skills. No empty `occupationUri` or `skillUri` on relations.

Every `occupationUri` in the relations file exists in `occupations_en.csv`. Every `skillUri` exists in `skills_en.csv`. No broken occupation–skill references were found.

## Issues found (do not ignore at import)

1. **Duplicate occupation URIs (4 URIs, 4 extra rows).** Same `conceptUri` and `preferredLabel`, different `modifiedDate`. Labels: early years teaching assistant; legal policy officer; mining, construction and civil engineering machinery distribution manager; food service worker. Import should keep the later `modifiedDate`.

2. **Duplicate skill URIs (21 URIs, 21 extra rows).** Same pattern (example: SQL). Import should keep the later `modifiedDate`.

3. **59 relation rows have empty `skillType`.** `occupationUri` and `skillUri` are still present and resolve. Treat `skillType` as optional on those rows.

Machine-readable hashes and the same counts are in `MANIFEST.json`.

Frontend `src/` and mock data were not modified.
