/** Gives the student a text file to keep: the browser saves it in its downloads. */
export function downloadTextFile(fileName: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // the browser needs a moment to start the download before the address goes away
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
