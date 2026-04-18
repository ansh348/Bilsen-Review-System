const AdmZip = require('adm-zip');

async function main() {
  const { parseStringPromise } = await import('xml2js');
  const zip = new AdmZip('C:\\Users\\anshu\\WebstormProjects\\cs319\\slides319.pptx');
  const entries = zip.getEntries();

  const slideEntries = entries
    .filter(e => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = parseInt(e.entryName.match(/slide(\d+)/)[1]);
      const numB = parseInt(e.entryName.match(/slide(\d+)/)[1]);
      return numA - numB;
    });

  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf8');
    const result = await parseStringPromise(xml);
    const slideNum = entry.entryName.match(/slide(\d+)/)[1];
    console.log('=== SLIDE ' + slideNum + ' ===');

    const texts = [];
    function findText(obj) {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'string') return;
      if (Array.isArray(obj)) { obj.forEach(findText); return; }
      if (obj['a:t']) {
        const tArr = Array.isArray(obj['a:t']) ? obj['a:t'] : [obj['a:t']];
        tArr.forEach(t => {
          const text = typeof t === 'string' ? t : (t._ || '');
          if (text.trim()) texts.push(text);
        });
      }
      Object.values(obj).forEach(findText);
    }
    findText(result);
    console.log(texts.join('\n'));
    console.log();
  }
}
main().catch(e => console.error(e));
