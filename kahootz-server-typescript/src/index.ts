// import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";

const NWS_API_BASE = "https://cwr.inovem.com/system/webapi";
const USER_AGENT = "weather-app/1.0";
const USEREMAIL = "support@kahootz.com";
const PASSWORD = "teaminitiative";

interface FolderInfo {
  name?: string;
  objectid?: number;
}

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string, isLogin: boolean, folderName: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  const requestBodyLogin = {
    params: {
      apiFunction: "startSession",
      apiParams: {
        useremail: USEREMAIL,
        password: PASSWORD
      }
    }
  };

  const requestBodyGetFolderInfo = {
    params: {
      apiFunction: "getFolderInfo",
      apiGroupEmail: "MTW1",
      apiToken: "",
      apiParams: {
        startRow: 1,
        maxRows: 10,
        whereParams: [
          {
            name: "name",
            comparison: "LIKE",
            value: `${folderName}%`
          }
        ],
        returnFolderInfo: "Y"
      },
      apiResponseDataFormat: "arrayOfObjects"
    }
  };

  let access_token = "";
  
  
  try {
    if(isLogin){
      // const response = await fetch(NWS_API_BASE, { params: JSON.stringify(requestBody) });

      let data = new FormData();
      data.append( "json", JSON.stringify( requestBodyLogin ) );

      const response = await fetch(NWS_API_BASE, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: data
      });
      const content = await response.json();
      if('tokenid' in content && content.tokenid !== ''){
        access_token = content.tokenid;
      }
    }
    // const response = await fetch(url, { headers });
    if(access_token !== ''){
      requestBodyGetFolderInfo.params.apiToken = access_token;
      let data = new FormData();
      data.append( "json", JSON.stringify( requestBodyGetFolderInfo ) );
      const response = await fetch(NWS_API_BASE, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: data
      });      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return (await response.json()) as T;
    }
    else{
      console.error("No access token available:");
      return null;
    }
  } 
  catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

// Schema definitions
const GetFolderInfoArgsSchema = z.object({
  term: z.string(),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;


// Create server instance
/* const server = new McpServer({
  name: "kahootz",
  version: "1.0.0",
}); */

const server = new Server(
  {
    name: "groups-kahootz-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_folder_info",
        description:
          "Get folder info from an api call. " +
          "Handles various text encodings and provides detailed error messages " +
          "if the folder cannot be found. Use this tool when you need to examine " +
          "the contents of a single folders.",
        inputSchema: zodToJsonSchema(GetFolderInfoArgsSchema) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_folder_info": {
        const parsed = GetFolderInfoArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_folder_info: ${parsed.error}`);
        }
        /* const validPath = await validatePath(parsed.data.path);
        const content = await fs.readFile(validPath, "utf-8"); */


        const termFormatted = parsed.data.term.toUpperCase();
        const apiUrl = `${NWS_API_BASE}`;
        const apiData = await makeNWSRequest<any>(apiUrl, true, parsed.data.term);

        if (!apiData) {
          return {
            content: [
              {
                type: "text",
                text: "Failed to retrieve api data",
              },
            ],
          };
        }

        const content: FolderInfo = {
          name: apiData.name || '',
          objectid: apiData.objectid || 0
        }

        if (content.objectid === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No item found for ${termFormatted}`,
              },
            ],
          };
        }

        const url = `https://groups.kahootz.com/development/view?objectID=${content.objectid}`;
        const text = `Here is the URL for the folder ${termFormatted}:\n\n${url}`;

        return {
          content: [{ type: "text", text }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});


/* server.tool(
  "get-folder-info",
  "Get folder name from text",
  {
    term: z.string().describe("Noun after the word 'called'"),
  },
  async ({ term }) => {
    const termFormatted = term.toUpperCase();
    const apiUrl = `${NWS_API_BASE}`;
    const apiData = await makeNWSRequest<any>(apiUrl, true, term);

    if (!apiData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve api data",
          },
        ],
      };
    }

    const content: FolderInfo = {
      name: apiData.name || '',
      objectid: apiData.objectid || 0
    }

    if (content.objectid === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No item found for ${termFormatted}`,
          },
        ],
      };
    }

    const url = `https://groups.kahootz.com/development/view?objectID=${content.objectid}`;
    const apiText = `Here is the URL for the folder ${termFormatted}:\n\n${url}`;

    return {
      content: [
        {
          type: "text",
          text: apiText,
        },
      ],
    };
  },
); */

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
