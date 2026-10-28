// Builds small, valid .xlsx files for tests (shared strings, optional deflate),
// plus a synthetic project report in the layout of the monthly builder reports.
// All names, numbers and emails are fictional.
import { crc32, deflateRawSync } from 'node:zlib';

function zip(files, { deflate = true } = {}) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(content);
    const body = deflate ? deflateRawSync(data) : data, method = deflate ? 8 : 0, crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, body);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directory, end]));
}

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ref = (r, c) => `${String.fromCharCode(65 + c)}${r + 1}`;

// sheets: { name: rows[][] }. Strings go to sharedStrings; `inline` uses inline strings instead.
export function buildXlsx(sheets, { deflate = true, inline = false } = {}) {
  const shared = [], index = new Map();
  const sid = s => { if (!index.has(s)) { index.set(s, shared.length); shared.push(s); } return index.get(s); };
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${Object.keys(sheets).map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships>${Object.keys(sheets).map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  Object.values(sheets).forEach((rows, i) => {
    const xml = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => v === '' || v == null ? '' : typeof v === 'number' ? `<c r="${ref(r, c)}"><v>${v}</v></c>`
      : inline ? `<c r="${ref(r, c)}" t="inlineStr"><is><t>${escape(v)}</t></is></c>` : `<c r="${ref(r, c)}" t="s"><v>${sid(v)}</v></c>`).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet><sheetData>${xml}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst>${shared.map(s => `<si><t xml:space="preserve">${escape(s)}</t></si>`).join('')}</sst>`;
  return zip(files, { deflate });
}

const HEAD = ['Sr. No.', 'Project', 'Builder', 'Architect', 'Other Professional Details'];
export function reportRows({ riversideStage = 'Prelaunch' } = {}) {
  return [
    ['DEMO PUNE PROJECT REPORTS - 2026.'],
    HEAD,
    [1, 'RIVERSIDE PH-II', 'Demo Lifespace Developers Ltd', 'Demo Associates:Ar.Vinay Rao', 'Purchase Manager:'],
    ['', 'Residential', 'CTS 6017,Pimpri Road,', 'Plot No.52,', 'Mr.Sunil Desai'],
    ['', '', 'Pune-411018.', 'Pune-411038.', 'sunil.desai@demo-lifespace.example'],
    ['', '', 'T: 020 4000 1001,9800000101.', 'T: 020 4000 2002.', 'Mr.Arun Mehta (Director)'],
    ['', '', 'info@demo-lifespace.example', 'studio@demo-assoc.example'],
    ['', 'Landmark: Sector R-33,Nande,Mulshi,Pune-412115.'],
    ['', `Project Details: 3 Towers of G+36 Floors with 654 Flats,${riversideStage}…............….Possession December 2028.`],
    ['', 'Product Details: Vitrified Flooring,12 Elevators,Aluminium Windows,Landscaped Garden,Paving Tiles.'],
    [],
    HEAD,
    [2, 'WAKAD NEW PROJECT-TOWER-1', 'Demo Homes Group', 'Ar.Pradeep Kale', 'Purchase Manager:'],
    ['', 'Residential', 'Demo Excelus,', 'B/101,Geeta Dham,', 'Mr.Bala Khade (Purchase)'],
    ['', '', 'Mumbai-400011.', 'Thane-421201.', 'bala.khade@demo-homes.example'],
    ['', '', 'M: 9800000201,022 6100 0202.', 'T: 0251 2200 0203,9800000204.', 'Mr.Yash Bhave (Director)'],
    ['', '', 'hello@demo-homes.example', 'pradeep.kale@demo-arch.example'],
    ['', 'Landmark: Sy No.76/1,Wakad,Pune-411057.'],
    ['', 'Project Details: Tower of G+14 Floors with 53 Flats,Excavation in Progress……………….Possession December 2028.'],
    ['', 'Product Details: Vitrified Flooring,2 Elevators,Swmming Pool,Gym,Landscaped Garden,Solar System,STP,RWH.'],
    HEAD,
    [3, 'NEEL PRABHA', 'Demo Vastu Developers', 'Ankur Demo Studio:Ar.Prakash Kulkarni', 'Purchase Manager:'],
    ['', 'Residential', '302,Shamsundar Building,', '101,Tejas,Ghole Road,', 'Mr.Sachin Kale (Director)'],
    ['', '', 'Pune-411004.', 'Pune-411005.', 'office@demo-vastu.example'],
    ['', '', 'M: 9800000301.', 'T: 020 3000 0302.'],
    ['', 'Landmark: Sy No.124/2B/1,Shivprasad Society,Parvati,Pune-411009.'],
    ['', 'Project Details: Tower of G+7 Floors with 21 Flats,RCC Completed…………Possession June 2027.'],
    ['', 'Product Details: Vitrified Flooring,4 Elevators,Gym,Swimming Pool,Generator,Landscaped Garden,RWH,STP.'],
  ];
}
export const report = options => buildXlsx({ 'Pune report': reportRows(options) });
