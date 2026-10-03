from .models import ToolCall
from .policy_engine import evaluate_policy
from .logger import log_event


def inspect_tool_call(tool_call: ToolCall):

    """
    Main AgentGuard inspection pipeline.

    Every AI agent tool request passes through
    AgentGuard before execution.
    """

    # Convert arguments to a searchable prompt
    prompt = str(
        tool_call.arguments
    )

    policy_result = evaluate_policy(
        tool_call.tool,
        prompt
    )

    result = {

        "agent_id":
            tool_call.agent_id,

        "tool":
            tool_call.tool,

        "arguments":
            tool_call.arguments,

        "risk":
            policy_result["risk"],

        "decision":
            policy_result["decision"],

        "reason":
            policy_result["reason"]
    }

    log_event(
        result.copy()
    )

    return result