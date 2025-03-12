from smolagents import CodeAgent

agent = CodeAgent(
    tools=[],           # Add search tool here
    model=None          # Add model here
)

web_agent = ToolCallingAgent(
    tools=[],           # Add required tools
    model=None,         # Add model
    max_steps=5,        # Adjust steps
    name="",           # Add name
    description=""      # Add description
)

manager_agent = CodeAgent()