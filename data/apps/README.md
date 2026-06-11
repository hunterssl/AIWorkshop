# Portal Apps

Place published application manifests in this directory as `*.json`.

Each manifest should include:

- `id`: unique app ID
- `name`: display name
- `prompt_template`: ComfyUI API prompt JSON (required)
- `params`: exposed form parameters

Example parameter item:

```json
{
  "key": "prompt",
  "label": "提示词",
  "type": "text",
  "default": "a cat",
  "bindings": [
    { "node_id": "6", "input_name": "text" }
  ]
}
```

Supported `type` values in this MVP:

- `text`
- `textarea`
- `number`
- `select`
- `toggle`

