import { BufferMemory } from 'langchain/memory';
import { OpenAI } from "langchain/llms/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { ConversationalRetrievalQAChain, ConversationChain, VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import actuator from 'express-actuator';
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import {
  JSONLoader,
  JSONLinesLoader,
} from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { SqlDatabase } from "langchain/sql_db";
import { createSqlAgent, SqlToolkit } from "langchain/agents";
import { DataSource } from "typeorm";
import cors from 'cors';
import * as path from 'path';

dotenv.config();


const model = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.9 });
let vectorStore: HNSWLib;
let chatHistory = '';

async function getVectorStore() {
  // Load in the file we want to do question answering over
  //const text = fs.readFileSync("Angular-Getting-started-with-standalone-components.txt", "utf8");

  const loader = new DirectoryLoader(
    path.join(__dirname, 'docs'),
    {
      ".json": (path) => new JSONLoader(path, "/texts"),
      ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path),
      ".pdf": (path) => new PDFLoader(path, { pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js")}),
    }
  );
  const docs = await loader.load();
  // Create the vectorstore 
  return await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
}

/*
async function getTools() {
  return [
    
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    
    new Calculator(),
    await createChainFromPDFFile()
  ];
}
*/

const app: Express = express();
app.use(cors({ origin: 'http://localhost:4200' }));
const port = process.env.PORT;

app.use(express.json());

app.post('/prompt', async (req: Request<{}, {}, { prompt: string }>, res: Response) => {
  const { prompt } = req.body;

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever()
  );

  const anotherChain = VectorDBQAChain.fromLLM(model, vectorStore, { returnSourceDocuments: true })
  anotherChain.memory = new BufferMemory();

  console.log("Loaded agent.");

  const modelResponse = await chain.call({question: prompt, chat_history: chatHistory.length > 0 ? chatHistory : [] });
  chatHistory += `QUESTION: \n ${prompt} \n\n RESPONSE: \n ${modelResponse.text}`;

  //fs.writeFileSync('./response.txt', modelResponse.output_text);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.status(200).send(modelResponse);
});

app.post('/prompt/sql', async (req: Request<{}, {}, { prompt: string }>, res: Response) => {
  const { prompt } = req.body;

  const datasource = new DataSource({
    type: "mysql",
    database: "vehicle_sales",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "P@ssw0rd"
  });

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });
  const toolkit = new SqlToolkit(db);
  const executor = createSqlAgent(model, toolkit);

  console.log("Loaded agent.");

  const modelResponse = await executor.call({input: prompt });

  //fs.writeFileSync('./response.txt', modelResponse.output_text);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.status(200).send(modelResponse);
})

app.use(actuator())

app.listen(port || 8080, async () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port || 8080}`);
  vectorStore = await getVectorStore();
  console.log('Vector Store Loaded');
});
