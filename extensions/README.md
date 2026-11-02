# Writing an extension

An extension is a folder with an `extension.json` and, if it adds commands, one script. Install it from **Extensions > Manage extensions > Install from folder**. Installing copies only those two files, so reinstall after each change.

```json
{
  "id": "my-extension",
  "name": "My extension",
  "version": "1.0.0",
  "description": "What it does, in one sentence.",
  "main": "main.js",
  "contributes": {
    "themes": [{ "id": "dusk", "label": "Dusk", "base": "dark", "colors": { "gold": "#ff9ecb" } }],
    "snippets": { "cpp": [["label", "digitalWrite(${1:pin}, HIGH);", "What the snippet does."]] },
    "commands": [{ "id": "hello", "title": "Say hello" }]
  }
}
```

- **Themes** override any of these colors, as `#rrggbb` or `#rrggbbaa`: `substrate`, `mask`, `mask-raised`, `edge`, `silk`, `silk-dim`, `silk-faint`, `gold`, `gold-hi`, `gold-ink`, `string`, `number`, `type`, `preproc`, `err`, `warn`, `ok`. Colors you leave out come from the base theme.
- **Snippets** can target `cpp`, `c`, `rust` or `python`, and use Monaco's `${1:placeholder}` syntax.
- **Commands** appear in the Extensions menu and the command palette, and can be given a shortcut in Settings.

## Script API

Register a handler for each command listed in `extension.json`:

```js
siliconforge.registerCommand('hello', async () => {
  const project = await siliconforge.getProject();
  siliconforge.showMessage(`Hello from ${project?.name ?? 'no project'}`);
});
```

| Call | Result |
|---|---|
| `getText()` | Text of the open file, or `null` when no file is open |
| `getSelection()` | The selected text |
| `getProject()` | `{ name, board, language }`, or `null` |
| `setText(text)` | Replaces the open file's text; Undo restores it |
| `insertText(text)` | Replaces the selection, or inserts at the cursor |
| `insertAtTop(text)` | Inserts at the start of the file |
| `showMessage(text)` | Prints a line to the Console |

Every call returns a promise.

## The sandbox

Scripts run in a Web Worker, so they have no access to Node, the page, your files or the network. The table above is everything a script can do. A command that runs for more than 10 seconds is stopped and its extension restarted.

See `sketch-helpers` and `phosphor-theme` in this folder for working examples.
