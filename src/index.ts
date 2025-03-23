import readline from "node:readline/promises";
import chalk from "chalk";
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  fsJson,
  fetchJson,
  llmParseJson,
  llmParseJsonJM,
  tools,
  processTools,
} from "./utils.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type OpenAIChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam & {
  tool_calls?: any[];
  tool_call_id?: string;
};

/**
 *  We'll read a JSON file containing a single array with data objects.
 */
const data = fsJson("src/data.json")["data"];
// console.log(data);
// let objects: Array<unknown>

let isDebug = false;

function dLog(...args: any[]) {
  if (isDebug) console.log(chalk.bgBlue(args[0]), ...args.slice(1));
}

async function callLLM(
  transcript: OpenAIChatMessage[]
): Promise<OpenAIChatMessage> {
  const completion = await openai.chat.completions.create({
    // model: "gpt-3.5-turbo",
    model: "gpt-4o-mini",
    messages: transcript,
    tools,
    // response_format: { type: "json_object" },
  });

  if (!completion.choices[0]?.message) {
    throw new Error("No message returned from OpenAI");
  }
  dLog("completion.choices[0].message", completion.choices[0].message);
  return completion.choices[0].message;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function cliLoop() {
  const answer = await rl.question("> ");

  if (answer.toLowerCase() === "$exit") {
    console.log("Goodbye!");
    rl.close();
    return;
  } else {
    const transcript: OpenAIChatMessage[] = [
      {
        role: "user",
        // Pull input from CLI
        content: answer,
      },
    ];

    const result = await callLLM(transcript);
    transcript.push(result);
    dLog("result", result);

    if (result.tool_calls) {
      dLog("result.tool_calls", result.tool_calls);
      const toolResponses = processTools(result.tool_calls, data);
      dLog("toolResponses", toolResponses);
      // console.log(toolResponse.length);
      for (let i = 0; i < result.tool_calls.length; i++) {
        transcript.push({
          role: "tool", // 'function' seems to break?
          tool_call_id: result.tool_calls[i]["id"],
          name: result.tool_calls[i]["function"]["name"],
          content: JSON.stringify(toolResponses[i]),
        });
      }
      dLog("new transcript", transcript);

      const result2 = await callLLM(transcript);
      console.log(chalk.green(result2.content) + "\n");
      await cliLoop();
    }
  }
}

async function run() {
  if (process.argv.length > 1) {
    if (process.argv[2] == "debug") {
      isDebug = true;
      console.log(chalk.bgBlue("[ Debug: true ]\n"));
    }
  }
  console.log(
    "Ask a question about the dataset, e.g. 'Tell me three names that include the letter a'. \n\nType '$exit' to quit.\n"
  );
  await cliLoop();
}

await run();
