import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const aiAgentTutorial = defineTutorial({
  id: 'ai-agent-system-architecture',
  title: 'How to Design AI Agent System Architecture',
  description: 'Build a production AI agent system. Learn multi-agent orchestration, tool calling, memory systems, agent supervision, and LangGraph-style workflows that power autonomous AI systems.',
  difficulty: 'advanced',
  estimatedMinutes: 30,
  tags: ['ai', 'agents', 'orchestration'],
  icon: 'Bot',
  color: '#7C3AED',

  levels: [
    level({
      title: 'The Orchestration Layer',
      steps: [
        step({
          component: 'Web Client', nodeType: 'client_web', noConnect: true,
          phases: {
            context: { heading: 'Welcome to AI Agent Architecture',
              body: 'AI agents are LLMs that take actions autonomously. Instead of one question → one answer, the user gives a goal and the system plans, executes tools, reflects on results, and iterates until the goal is achieved.' },
            intro: { heading: 'Goal-oriented interaction', body: 'The client sends a goal ("research competitors and write a report") not a query. The UI must handle async execution — showing live progress as the agent works through sub-tasks.' },
            teaching: { heading: 'Why agents change UX fundamentally',
              body: 'Traditional LLM apps are synchronous: user waits 1-2s. Agent apps are asynchronous: execution can take minutes. The client must show live agent thought traces, tool call logs, and intermediate outputs — or users think the system crashed.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web Client', and add the Web Client." },
            connecting: { heading: 'No connections yet', body: 'First step.' },
            celebration: { heading: 'Web Client added.', body: 'Now the API Gateway.' },
          },
          hints: ['Search for "Web Client"'],
        }),
        step({
          component: 'API Gateway', nodeType: 'api_gateway', parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Agents consume tokens rapidly. A single agent loop can generate thousands of tokens across dozens of LLM calls. Token budgets at the gateway are what make agents economically viable.' },
            intro: { heading: 'Token budgets, not just rate limits', body: 'Unlike regular APIs where you rate limit by request count, agent APIs need token budgets — maximum tokens per session, per user, per day.' },
            teaching: { heading: 'Why agents need special gateway logic',
              body: 'An agent that enters an infinite loop (a known failure mode) will exhaust a $500 API budget in hours. The gateway must enforce: max tokens per session, max loop iterations, circuit breakers for runaway tool calls. Without this, agents are not safely deployable.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Web Client → API Gateway.' },
            celebration: { heading: 'API Gateway added.', body: 'Now the Orchestrator.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Agent Orchestrator', nodeType: 'agent_orchestrator', parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Agent Orchestrator', body: 'The Orchestrator receives a goal, decomposes it into a plan (a sequence of sub-tasks), assigns each sub-task to a specialized agent, and coordinates their execution.' },
            intro: { heading: 'The brain of the system', body: 'Given "research competitors", it plans: identify competitors → web search each → extract data → synthesize report. Each step is delegated to the right specialist.' },
            teaching: { heading: 'Planning vs execution separation',
              body: 'The Orchestrator uses a planning LLM call (expensive, high-reasoning model) to decompose the goal, then delegates execution to smaller, cheaper sub-agents. This is the key cost optimization: use GPT-4 for 1 planning call, use GPT-3.5 for 20 execution calls.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Agent Orchestrator', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect API Gateway → Agent Orchestrator.' },
            celebration: { heading: 'Orchestrator added.', body: 'Now the Tool Registry.' },
          },
          hints: ['Search for "Agent Orchestrator"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Tool Registry', nodeType: 'tool_registry', parent: 'Agent Orchestrator',
          phases: {
            context: { heading: 'Step 4: Tool Registry', body: 'Agents act through tools: web search, code execution, database queries, API calls. The Tool Registry is the catalogue of available tools with their schemas, permissions, and rate limits.' },
            intro: { heading: 'Tools are the agent\'s hands', body: 'Without tools, an agent can only generate text. With tools it can search the web, run code, query databases, send emails, book meetings.' },
            teaching: { heading: 'Why a registry matters at scale',
              body: 'In production, agents need guardrails on tool use: which agents can call which tools, how many calls per minute, what data can be passed to external APIs. The registry enforces these policies. Without it, an agent could call a payment API unguarded.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Tool Registry', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Agent Orchestrator → Tool Registry.' },
            celebration: { heading: 'Tool Registry added.', body: 'Now Agent Memory.' },
          },
          hints: ['Search for "Tool Registry"', 'Connect Agent Orchestrator to it'],
        }),
        step({
          component: 'Agent Memory', nodeType: 'agent_memory', parent: 'Agent Orchestrator',
          phases: {
            context: { heading: 'Step 5: Agent Memory', body: 'Agent Memory stores context across turns and sessions. Without memory, every new user message starts from scratch — the agent forgets everything from the previous conversation.' },
            intro: { heading: 'Three types of memory', body: 'Working memory (current session context), episodic memory (past conversation history), semantic memory (long-term facts about the user and domain).' },
            teaching: { heading: 'Memory is what makes agents personal',
              body: 'A coding agent with memory knows your preferred language, your codebase conventions, and your past decisions. Without memory, it asks the same clarifying questions every session. The architecture challenge: memory retrieval must be fast (<100ms) so it doesn\'t dominate the agent\'s latency budget.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Agent Memory', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Agent Orchestrator → Agent Memory.' },
            celebration: { heading: 'Agent Memory added.', body: 'Now the LLM.' },
          },
          hints: ['Search for "Agent Memory"', 'Connect Agent Orchestrator to it'],
        }),
        step({
          component: 'LLM API (GPT / Claude)', nodeType: 'llm_api', parent: 'Agent Orchestrator',
          phases: {
            context: { heading: 'Step 6: LLM API', body: 'The LLM is called multiple times per agent loop: once to plan, once per tool-call decision, once to synthesize the final output. Each call uses the context from memory and tool results.' },
            intro: { heading: 'Multiple LLM calls per task', body: 'A 5-step agent task might make 15-20 LLM calls. Cost and latency multiply accordingly.' },
            teaching: { heading: 'The agent loop in detail',
              body: '1. LLM receives goal + memory + available tools. 2. LLM outputs a tool call (structured JSON). 3. Tool executes, result returned. 4. LLM receives result, decides next action. 5. Repeat until done. This ReAct loop (Reason + Act) is the foundation of all modern agent frameworks (LangChain, AutoGen, LangGraph).' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'LLM API', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Agent Orchestrator → LLM API.' },
            celebration: { heading: 'LLM API added.', body: 'Core agent loop complete!' },
          },
          hints: ['Search for "LLM API"', 'Connect Agent Orchestrator to it'],
        }),
      ],
    }),
    level({
      title: 'Supervision & Reliability',
      steps: [
        step({
          component: 'Agent Supervisor', nodeType: 'agent_supervisor', parent: 'Agent Orchestrator',
          phases: {
            context: { heading: 'Level 2: Supervision', body: 'Agents fail in unexpected ways: infinite loops, tool misuse, hallucinated tool parameters, cost overruns. The Supervisor monitors all agent activity and intervenes when failure patterns are detected.' },
            intro: { heading: 'The safety net', body: 'The Supervisor watches every tool call, every LLM output, and every loop iteration. It can pause, reroute, or terminate runaway executions.' },
            teaching: { heading: 'Why supervision is non-negotiable in production',
              body: 'Without a Supervisor, an agent that hits an error will often retry in a loop until the token budget is exhausted. The Supervisor detects repeated identical tool calls (loop detection), failed tool results that exceed retry thresholds, and cost exceeding per-session limits. Then it fails gracefully with a partial result.' },
            action: { heading: 'Your turn!', body: "Press ⌘K, search for 'Agent Supervisor', and add it." },
            connecting: { heading: 'Connect it', body: 'Connect Agent Orchestrator → Agent Supervisor.' },
            celebration: { heading: 'AI Agent architecture complete!', body: 'You built a production-ready multi-agent system.' },
          },
          hints: ['Search for "Agent Supervisor"', 'Connect Agent Orchestrator to it'],
        }),
      ],
    }),
  ],
});

export default aiAgentTutorial;
