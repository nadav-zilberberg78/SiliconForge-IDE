// Runs in a sandboxed worker. `siliconforge` is the only way to reach the IDE. See extensions/README.md.
siliconforge.registerCommand('add-header', async () => {
  const project = await siliconforge.getProject();
  const about = project ? `${project.name} for ${project.board}` : 'New file';
  await siliconforge.insertAtTop(`// ${about}\n// Created ${new Date().toISOString().slice(0, 10)}\n\n`);
});

siliconforge.registerCommand('count-lines', async () => {
  const text = await siliconforge.getText();
  if (text === null) return siliconforge.showMessage('Open a file first.');
  const code = text.split('\n').filter((line) => line.trim() && !line.trim().startsWith('//'));
  siliconforge.showMessage(`${code.length} lines of code`);
});
