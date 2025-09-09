# Fail Policy Table v1.0

Hard = stop voor veld / retourneert 422 bij live‐flow.
Soft = veld wordt gemarkeerd als `partial`; flow gaat door.

| Field | Reason Code | Severity |
|-------|-------------|----------|
| **title** | invalid_character | hard |
|           | title_length_exceeded | hard |
|           | missing_focus_keyword | soft |
|           | excessive_caps | soft |
| **description** | invalid_character | hard |
|              | missing_description_sections | soft |
|              | non_compliant_tone | soft |
| **tags** | invalid_character | hard |
|           | invalid_tagcount | soft |
|           | tag_length_violation | soft |
|           | redundant_tag_content | soft |
| **global** | json_parse_error | hard |
|            | ascii_breach | hard |

policy_version: v1.0
