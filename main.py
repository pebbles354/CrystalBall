import os
import csv
from datetime import datetime
from io import StringIO  

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from groq import Groq
from openai import AsyncOpenAI
from pydantic import BaseModel

from agent import get_final_reasoning, run_agent_processing
from model import Agent, EventContext

from fastapi.middleware.cors import CORSMiddleware

from toolhouse_helper import get_real_context




# Load environment variables from .env file
load_dotenv()
app = FastAPI()

# add cors middleware
# Allow requests from the frontend URL
origins = [
    "http://localhost:5173",  # Frontend (Vite) running on localhost
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows access from these origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers (Content-Type, Authorization, etc.)
)


# Load Groq API key from environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is not set")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY environment variable is not set")
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@app.post("/chatWithGroq", response_model=ChatResponse)
async def chat_with_groq(request: ChatRequest):
    try:
        client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initializing Groq client: {str(e)}")
    
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": request.message,
                }
            ],
            model="llama3-8b-8192",
        )

        # Extract the content from the response
        response_content = chat_completion.choices[0].message.content
        return ChatResponse(response=response_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with Groq: {str(e)}")
    
@app.post("/chatWithOpenAI", response_model=ChatResponse)
async def chat_with_openai(request: ChatRequest):
    try:
        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
        response = await client.chat.completions.create(
            messages=[
                {"role": "user", "content": request.message}
            ],
            model="openai/o1-preview-2024-09-12"
        )
        return ChatResponse(response=response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with OpenRouter: {str(e)}")

@app.post("/chatWithToolhouse", response_model=ChatResponse)
async def chat_with_toolhouse(request: ChatRequest):
    # This is a placeholder function for chat completion with Toolhouse
    return ChatResponse(response="This is a placeholder response from Toolhouse")

@app.post("/getRealContext", response_model=ChatResponse)
async def get_real_context(request: Agent):
    response = await get_real_context(request.dict())
    if response is None:
        raise HTTPException(status_code=500, detail="Error getting real context")
    return ChatResponse(response=response)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/processAgents")
async def process_agents(event_context: EventContext):
    input_csv_file_path = 'AgentTestData.csv'  # Hardcoded input CSV file path
    try:
        processed_agents = await run_agent_processing(input_csv_file_path, event_context)
        
        output_csv_file_path = f'ProcessedAgents.csv'
        
        # Save processed agents to the new CSV file
        with open(output_csv_file_path, 'w', newline='') as csvfile:
            fieldnames = ['name', 'category', 'subcategory', 'weight', 'description', 'isReal', 'realContext', 'llmResponse']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for agent in processed_agents:
                writer.writerow(agent)
        
        return {"agents": processed_agents, "output_file": output_csv_file_path}
    except Exception as e:
        print(f"Error in process_agents: {str(e)}")  # Add this line for debugging
        raise HTTPException(status_code=500, detail=f"Error processing agents: {str(e)}")
    
@app.post("/processAgentsLite")
async def process_agents_lite(event_context: EventContext):
    input_csv_file_path = 'AgentTestDataLite.csv'  # Hardcoded input CSV file path
    try:
        processed_agents = await run_agent_processing(input_csv_file_path, event_context)
        
        output_csv_file_path = f'ProcessedAgents.csv'
        
        # Save processed agents to the new CSV file
        with open(output_csv_file_path, 'w', newline='') as csvfile:
            fieldnames = ['name', 'category', 'subcategory', 'weight', 'description', 'isReal', 'realContext', 'llmResponse']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for agent in processed_agents:
                writer.writerow(agent)
        
        return {"agents": processed_agents, "output_file": output_csv_file_path}
    except Exception as e:
        print(f"Error in process_agents: {str(e)}")  # Add this line for debugging
        raise HTTPException(status_code=500, detail=f"Error processing agents: {str(e)}")
    
# New endpoint to serve the CSV file
@app.get("/download_csv")
async def download_csv():
    output_csv_file_path = 'ProcessedAgents.csv'
    
    if os.path.exists(output_csv_file_path):
        response = FileResponse(
            output_csv_file_path, 
            media_type='text/csv', 
            filename='ProcessedAgents.csv'
        )
        # Manually add CORS headers
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"  # Or "*" if you want to allow all origins
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    else:
        raise HTTPException(status_code=404, detail="CSV file not found")
    
@app.get("/test_cors")
async def test_cors():
    return {"message": "CORS is working"}

@app.post("/getFinalReasoning")
async def process_agents_and_get_final_reasoning(event_context: EventContext):
    csv_file_path = 'ProcessedAgents.csv'  # Hardcoded CSV file path
    
    try:
        # Load the CSV file and convert it to a string
        with open(csv_file_path, 'r') as file:
            csv_data = file.read()
        
        # Create a StringIO object from the CSV string
        csv_string = StringIO(csv_data)
        
        # Pass the CSV string to the get_final_reasoning function
        final_reasoning = await get_final_reasoning(csv_string, event_context)
        
        return {"final_reasoning": final_reasoning}
    except Exception as e:
        print(f"Error in process_agents_and_get_final_reasoning: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing agents and getting final reasoning: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
