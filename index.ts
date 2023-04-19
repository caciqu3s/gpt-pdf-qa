import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { BufferMemory } from "langchain/memory";
import { SerpAPI, ChainTool } from "langchain/tools";
import { ConversationalRetrievalQAChain, loadQARefineChain, RetrievalQAChain, VectorDBQAChain } from "langchain/chains";
import { Calculator } from "langchain/tools/calculator";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import actuator from 'express-actuator';
import { getTextFromFiles } from './src/doc-reader';
import * as fs from 'fs';

dotenv.config();


const model = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.9 });
let vectorStore: HNSWLib;
let chatHistory = '';

async function getVectorStore() {
  // Load in the file we want to do question answering over
  //const text = fs.readFileSync("Angular-Getting-started-with-standalone-components.txt", "utf8");
  const texts = await getTextFromFiles();
  // Split the text into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments(texts);
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
const port = process.env.PORT;

app.use(express.json());

app.post('/prompt', async (req: Request<{}, {}, { prompt: string }>, res: Response) => {
  const { prompt } = req.body;

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true
    }
  );

  const anotherChain = VectorDBQAChain.fromLLM(model, vectorStore, { returnSourceDocuments: true })

  console.log("Loaded agent.");

  const modelResponse = await chain.call({question: prompt, chat_history: chatHistory.length > 0 ? chatHistory : [] });
  chatHistory += prompt + modelResponse.text;

  //fs.writeFileSync('./response.txt', modelResponse.output_text);

  res.status(200).send(modelResponse);
});

app.use(actuator())

app.listen(port || 8080, async () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port || 8080}`);
  vectorStore = await getVectorStore();
  console.log('Vector Store Loaded');
});