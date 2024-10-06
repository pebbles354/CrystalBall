import asyncio
import csv
import json
import re
from typing import Dict, List
import os
from groq import AsyncGroq
from openai import AsyncOpenAI

from model import Agent, Direction, EventContext, LLMResponse
from prompts import get_final_reasoning_agent_prompt, get_final_reasoning_system_prompt, get_process_agents_system_prompt, get_process_agents_user_prompt
from toolhouse_helper import get_real_context

def preprocess_json(s: str) -> str:
    def remove_space_around_colon(match):
        return match.group(1) + ':' + match.group(3)
    
    # This regex looks for a colon with optional spaces around it,
    # but not inside quotes
    pattern = r'([^"\s:]+)\s*:\s*([^"\s\[{]+|"[^"]*"|\[[^\]]*\]|{[^}]*})'
    return re.sub(pattern, remove_space_around_colon, s)

def create_agents_from_csv(csv_file_path: str) -> List[Agent]:
    agents = []
    
    with open(csv_file_path, 'r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            agent = Agent(
                subcategory=row['Subcategory (id)'],
                name=row['Name'],
                category=row['Category'],
                description=row['Description'],
                isReal=row['isReal'],
                weight=row['Weight']
            )
            agents.append(agent)
    
    return agents

async def process_real_agents(agents: List[Agent], event_context: str) -> List[Agent]:
    async def process_agent(agent: Agent):
        if agent.isReal:
            updated_agent = await get_real_context(agent.dict(), event_context)
            if updated_agent:
                agent.realContext = updated_agent.get("realContext", "")
        return agent

    tasks = [process_agent(agent) for agent in agents]
    processed_agents = await asyncio.gather(*tasks)
    
    return processed_agents

async def process_agents_with_groq(agents: List[Agent], event_context: str) -> List[Agent]:
    client = AsyncGroq()
    
    async def process_agent(agent: Agent, model: str):
        system_prompt = get_process_agents_system_prompt(event_context)
        user_prompt = get_process_agents_user_prompt(agent, event_context)

        response_content = ""  # Initialize the variable

        try:
            chat_completion = await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=model,
            )
            response_content = chat_completion.choices[0].message.content

            try:
                preprocessed_content = preprocess_json(response_content)
                jsonified_content = json.dumps(preprocessed_content)
                llm_response = json.loads(jsonified_content)
                print(f"Agent: {agent.name}, Model: {model}, Response: {llm_response}")
                agent.llmResponse = LLMResponse(
                    direction=Direction(llm_response["direction"]),
                    strength=float(llm_response["strength"]),
                    rationale=str(llm_response["rationale"])
                )
            except json.JSONDecodeError as e:
                print(f"JSON parsing error for agent {agent.name} with model {model}: {str(e)}")
                agent.llmResponse = LLMResponse(
                    direction=Direction.HOLD,
                    strength=0.0,
                    rationale=f"Error processing response with model {model}. Raw content: {response_content}"
                )
        except Exception as e:
            print(f"Error processing agent {agent.name} with model {model}: {str(e)}")
            agent.llmResponse = LLMResponse(
                    direction=Direction.HOLD,
                    strength=0.0,
                    rationale=f"Error processing response with model {model}. Raw content: {response_content}"
                )
        
        return agent

    # Separate real agents and non-real agents
    real_agents = [agent for agent in agents if agent.isReal]
    non_real_agents = [agent for agent in agents if not agent.isReal]

    # Create tasks for real agents using llama-3.1-70b-versatile
    real_agent_tasks = [process_agent(agent, "llama-3.1-70b-versatile") for agent in real_agents]

    # Define the models for non-real agents
    models = ["llama-3.1-8b-instant", "llama3-70b-8192", "llama3-8b-8192", "llama-3.1-70b-versatile"]
    
    # Distribute non-real agents evenly among the models
    non_real_agent_tasks = []
    for i, agent in enumerate(non_real_agents):
        model = models[i % len(models)]
        non_real_agent_tasks.append(process_agent(agent, model))

    # Process agents in batches
    all_tasks = real_agent_tasks + non_real_agent_tasks
    batch_size = len(all_tasks) // 2  # Divide tasks into 2 batches
    processed_agents = []

    for i in range(2):
        start_idx = i * batch_size
        end_idx = start_idx + batch_size if i < 2 else len(all_tasks)
        
        print(f"Processing batch {i+1} of 2...")
        batch_tasks = all_tasks[start_idx:end_idx]
        batch_results = await asyncio.gather(*batch_tasks)
        processed_agents.extend(batch_results)
        
        if i < 1:  # Don't wait after the last batch
            print(f"Waiting 60 seconds before next batch...")
            await asyncio.sleep(60)  # Wait for 60 seconds

    return processed_agents

async def process_agents(csv_file_path: str, event_context: EventContext) -> List[Agent]:
    agents = create_agents_from_csv(csv_file_path)
    agents_with_real_context = await process_real_agents(agents, event_context)
    return await process_agents_with_groq(agents_with_real_context, event_context)

async def run_agent_processing(csv_file_path: str, event_context: EventContext) -> List[Dict]:
    processed_agents = await process_agents(csv_file_path, event_context)
    return [agent.dict() for agent in processed_agents]

async def get_final_reasoning(processed_agents, event_context: EventContext) -> Dict:
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    system_prompt = get_final_reasoning_system_prompt()
    
    user_prompt = get_final_reasoning_agent_prompt(processed_agents, event_context)

    # Truncate user prompt if it exceeds 30,000 words
    user_prompt_words = user_prompt.split()
    if len(user_prompt_words) > 30000:
        user_prompt = ' '.join(user_prompt_words[:30000])
    
    try:
        chat_completion = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="openai/o1-preview-2024-09-12"
        )
        
        response_content = chat_completion.choices[0].message.content
        return response_content
    except Exception as e:
        print(f"Error in get_final_reasoning: {str(e)}")
        return get_error_response("Error in processing final reasoning")

def get_error_response(error_message: str) -> Dict:
    return {
        "market_prediction": "NEUTRAL",
        "buy_percentage": 0.0,
        "sell_percentage": 0.0,
        "hold_percentage": 100.0,
        "weighted_buy_probability": 0.0,
        "weighted_sell_probability": 0.0,
        "summary": error_message,
        "notable_divergences": "N/A"
    }

