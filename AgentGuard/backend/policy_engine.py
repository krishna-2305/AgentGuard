import re


# ============================================================
# THREAT PATTERNS
# ============================================================

INJECTION_PATTERNS = {

    r"drop\s+database":
        "Database destruction attempt",

    r"rm\s+-rf":
        "Destructive shell command",

    r"sudo":
        "Privilege escalation attempt",

    r"ignore\s+previous\s+instructions":
        "Prompt injection attempt",

    r"dump\s+passwords":
        "Credential extraction attempt",

    r"eval\(":
        "Dynamic code execution",

    r"exec\(":
        "Arbitrary code execution"
}


# ============================================================
# TOOL POLICIES
# ============================================================

SAFE_TOOLS = {

    "search_web",
    "read_docs",
    "get_weather"
}


REVIEW_TOOLS = {

    "send_email",
    "write_database",
    "post_tweet"
}


DANGEROUS_TOOLS = {

    "execute_shell",
    "drop_database_table",
    "delete_file"
}


# ============================================================
# POLICY ENGINE
# ============================================================

def evaluate_policy(
    tool: str,
    prompt: str = ""
) -> dict:

    prompt_lower = (
        prompt or ""
    ).lower()

    # --------------------------------------------------------
    # 1. PROMPT / PAYLOAD THREAT SCAN
    # --------------------------------------------------------

    for pattern, description in INJECTION_PATTERNS.items():

        if re.search(
            pattern,
            prompt_lower
        ):

            return {

                "risk": "RED",

                "decision": "BLOCK",

                "reason":
                    f"Threat detected: {description}."
            }

    # --------------------------------------------------------
    # 2. SAFE TOOLS
    # --------------------------------------------------------

    if tool in SAFE_TOOLS:

        return {

            "risk": "GREEN",

            "decision": "ALLOW",

            "reason":
                "Low-risk read-only operation."
        }

    # --------------------------------------------------------
    # 3. HUMAN REVIEW
    # --------------------------------------------------------

    if tool in REVIEW_TOOLS:

        return {

            "risk": "AMBER",

            "decision":
                "APPROVAL_REQUIRED",

            "reason":
                "This operation affects an "
                "external system or user state "
                "and requires human approval."
        }

    # --------------------------------------------------------
    # 4. DANGEROUS TOOLS
    # --------------------------------------------------------

    if tool in DANGEROUS_TOOLS:

        return {

            "risk": "RED",

            "decision": "BLOCK",

            "reason":
                "Potentially destructive or "
                "highly sensitive system-level "
                "operation."
        }

    # --------------------------------------------------------
    # 5. UNKNOWN TOOL
    # --------------------------------------------------------

    return {

        "risk": "AMBER",

        "decision":
            "APPROVAL_REQUIRED",

        "reason":
            "Unknown tool detected. "
            "AgentGuard defaults to human "
            "approval for unrecognized actions."
    }