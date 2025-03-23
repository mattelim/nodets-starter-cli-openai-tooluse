import fs from "fs";
import { jsonrepair } from "jsonrepair";

export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  const json = await response.json();
  return json;
}

// const testData = await fetchJson(
//   "https://jsonplaceholder.typicode.com/todos/1"
// );
// console.log(testData);

export function fsJson(path: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

//       content: `Generate some dummy data for ${
//         data[Math.floor(Math.random() * data.length)]["name"]
//       }. I would like at least an address, occupation, and brief bio.

// You must return the data in JSON format in this form:
// \`\`\`
// <json />
// \`\`\`
// `,

export function llmParseJson(content: string): Record<string, any> | undefined {
  // console.log(content);
  const matched = content.match(/```(json?\s*)?(.*?)```/s);
  // console.log("matched", matched);
  const extracted = matched![2];
  // console.log(extracted);
  try {
    return JSON.parse(jsonrepair(extracted!));
  } catch (e: any) {
    console.error("JSON parsing failed");
  }
  return;
}

// const pObj = llmParseJson(result['content']!)!;
// console.log(pObj, Object.keys(pObj!));

export function llmParseJsonJM(
  content: string
): Record<string, any> | undefined {
  try {
    return JSON.parse(jsonrepair(content));
  } catch (e: any) {
    console.error("JSON parsing failed");
  }
  return;
}

type TPerson = {
  name: string;
  age: number;
  email: string;
};

type TToolCall = {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
};

// const pObj = llmParseJsonJM(result["content"]!);
// console.log(pObj, Object.keys(pObj!));

export const tools = [
  {
    type: "function",
    function: {
      name: "search_dataset",
      description: "Query a dataset to based on a string provided by the user",
      parameters: {
        type: "object",
        properties: {
          queryType: {
            type: "array",
            description: "What aspects to query the dataset by.",
            items: {
              type: "string",
              enum: ["name", "age"],
            },
          },
          nameQuery: {
            type: ["string", "null"],
            description: "The user search query for name string matching.",
          },
          ageQuery: {
            type: ["object", "null"],
            description: "The user search query for filtering by age.",
            properties: {
              type: {
                type: "string",
                enum: ["less_than_or_equal", "greater_than_or_equal"],
                description: "Filter by lte or gte.",
              },
              value: {
                type: "number",
                description: "Age value to filter by.",
              },
            },
            required: ["type", "value"],
            additionalProperties: false,
          },
          options: {
            type: "object",
            properties: {
              num_results: {
                type: ["number", "null"],
                description:
                  "Number of top results to return. Pass null if not specified.",
              },
              sort_by: {
                type: ["string", "null"],
                enum: ["alphabetical", "reverse-alphabetical"],
                description: "How to sort results. Pass null if not needed.",
              },
            },
            required: ["num_results", "sort_by"],
            additionalProperties: false,
          },
        },
        required: ["queryType", "nameQuery", "ageQuery", "options"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

type TQueryType = "name" | "age";

export function searchDataset({
  dataset,
  queryType,
  nameQuery,
  ageQuery,
  options,
}: {
  dataset: TPerson[];
  queryType: TQueryType[];
  nameQuery: string;
  ageQuery: {
    type: "less_than_or_equal" | "more_than_or_equal";
    value: number;
  };
  options: {
    num_results: number;
    sort_by: ("alphabetical" | "reverse-alphabetical") | undefined;
  };
}): TPerson[] {
  const { num_results: numResults, sort_by: sortBy } = options;
  let filtered = [...dataset];

  if (queryType.includes("age")) {
    switch (ageQuery.type) {
      case "less_than_or_equal": {
        filtered = filtered.filter((data) => data.age <= ageQuery.value);
        break;
      }
      default:
      case "less_than_or_equal": {
        filtered = filtered.filter((data) => data.age >= ageQuery.value);
        break;
      }
    }
  }
  // console.log("after age:", filtered);

  if (queryType.includes("name")) {
    filtered = filtered.filter((data) =>
      data.name.toLowerCase().includes(nameQuery.toLowerCase())
    );
  }
  // console.log("after name:", filtered);

  if (numResults) {
    filtered = filtered.slice(0, numResults);
  }

  if (sortBy) {
    switch (sortBy) {
      case "reverse-alphabetical": {
        filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
      }
      case "alphabetical":
      default: {
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  return filtered;
}

export function processTools(
  toolCalls: TToolCall[],
  dataset: TPerson[]
): any[] {
  const toolResults = [];
  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall["function"];
    switch (name) {
      case "search_dataset":
      default: {
        const argsJson = JSON.parse(jsonrepair(args));
        const { queryType, nameQuery, ageQuery, options } = argsJson;
        toolResults.push(
          searchDataset({ dataset, queryType, nameQuery, ageQuery, options })
        );
      }
    }
  }
  return toolResults;
}

// console.log(result.tool_calls);
// if (result["tool_calls"]) {
//   const toolResponse = processTools(result["tool_calls"], data);
//   console.log(toolResponse);
//   console.log(toolResponse.length);
// }
