/** Gives the student a file to keep: the browser saves it in its downloads. */
function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
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

/** Gives the student a text file to keep. */
export function downloadTextFile(fileName: string, text: string, mime = 'application/json'): void {
  saveBlob(fileName, new Blob([text], { type: mime }));
}

/** Gives the student a binary file to keep, such as a MIDI file. */
export function downloadBytes(fileName: string, bytes: Uint8Array, mime = 'audio/midi'): void {
  // a copy, so that the blob never depends on a buffer the caller still uses
  saveBlob(fileName, new Blob([new Uint8Array(bytes)], { type: mime }));
}
