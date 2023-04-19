import * as fs from 'fs';
import * as path from 'path';
import pdf from "pdf-parse";

export async function getTextFromFiles(): Promise<string[]> {
  const fullPath = path.join(__dirname, 'docs')
  const files = fs.readdirSync(fullPath, { withFileTypes: true});
  let text: string[] = [];

  files.forEach(file => console.log(file.name))

  try {
    for(let i = 0; i < files.length; i++) {
      console.log("cu");
      text[i] = await readFile(path.join(fullPath, files[i].name));
    }
  }
  catch (error) { console.error(error) } 

  return text;
}

async function readFile(src: string) {
  console.log('teste 2');
  console.log(src);
  const dataBuffer = fs.readFileSync(src);
  
  const { text } = await pdf(dataBuffer);

  console.log("Texto:" + text);

  return text;
}