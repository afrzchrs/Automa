def get_model_list():
    model_list = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
    ]

    return model_list

def model_agent_rotator(used_history_model):
    models = get_model_list()

    for model in models:
        if model not in used_history_model:
            return model