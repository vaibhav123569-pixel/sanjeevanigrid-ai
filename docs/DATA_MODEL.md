# SanjeevaniGrid AI data model

The default showcase stores its fictional geography and road graph in `src/domain/scenario.ts` and mirrors the scenario in `data/demo-scenario.json`. These records are labeled as sample data and are not copied into Firestore on startup.

## Firestore collections

| Collection | Document purpose | Access boundary |
|---|---|---|
| `users/{uid}` | Display name, preferred language and role (`citizen` or `responder`). | User reads own profile; role assignment is administrative and cannot be changed from the client. |
| `citizen_reports/{id}` | Consent-based VoiceSOS report: caller description, explicitly stated fields, location confirmation, source, verification status and timestamp. | Authenticated reporter creates and reads own record; responder reads and updates review fields. |
| `image_evidence/{id}` | Consent record, Storage path, content type, byte length and review state for road evidence. | Uploader and responders may read metadata. Create requires authenticated uploader and consent. |
| `responder_actions/{id}` | Append-only review audit: incident ID, action, note, responder UID and timestamp. | Responder creates; responder and action owner can read; no client update/delete. |
| `incidents/{id}` | Future joined incident record with source, location, evidence references, risk, assignment and lifecycle status. | Not written by this MVP. Add server-side validation and rules before use. |
| `villages/{id}` | Future authoritative village identity, geospatial point and verified access links. | The app currently uses local demo seed data. |
| `healthcare_facilities/{id}` | Future facility services, contact, capacity and verified availability updates. | The app currently uses local demo seed data. |
| `road_segments/{id}` | Future graph edge, bridge flag, verified condition, source and observation time. | The app currently uses local demo seed data. |
| `route_recommendations/{id}` | Future route candidate, graph version, reasons, risk factors and responder decision. | Route candidates are calculated in the browser for the sample graph in this MVP. |
| `simulation_scenarios/{id}` | Future saved deterministic scenario configuration and timeline. | The current simulation is a code-defined deterministic example. |

## Report fields

VoiceSOS reports use:

```text
incidentId, kind, description, affectedPeople, symptoms,
location, roadHazard, urgency, verificationStatus, source,
dataSource, consent, reporterUid, createdAt
```

The transcript is only sent to Gemini after the user selects the AI-sharing consent option. It is only added to Firestore after the separate responder-sharing consent is checked and the submit action is taken. The local demo queue is stored in React memory and is cleared by simulation reset or page reload.

## Separation of sources

- `SIMULATION`: deterministic scenario events and locally queued demo reports.
- `DEMO SEED`: static illustrative records shipped with the showcase.
- `LIVE`: consented citizen report loaded from configured Firestore.

Do not merge these sources for operational analytics without preserving the source label, verification state, event time and provenance.
