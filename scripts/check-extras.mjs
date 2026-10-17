const d = [];
process.stdin.on("data", (c) => d.push(c));
process.stdin.on("end", () => {
  const b = JSON.parse(d.join("")).books.find((x) => x.title.includes("Riel de la"));
  const e = b.extras ?? {};
  console.log(JSON.stringify({
    notation: e.notation,
    resultsCount: e.results?.length,
    reproStates: e.repro?.states,
    xrayCount: e.xray?.length,
    lockedNotesCount: e.lockedNotes?.length,
    prediction: e.prediction?.text?.slice(0, 60),
    threePass: e.threePass?.checked,
    codeSnippet: !!e.codeSnippet,
    pause: e.pause,
  }, null, 1));
});
