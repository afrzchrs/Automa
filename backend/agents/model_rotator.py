def get_model_list():
    """
    Fungsi ini memilih model AI yang akan digunakan untuk setiap agen.
    Saat ini, semua agen menggunakan model Gemini 3.5 Flash.
    """
    # Daftar model yang tersedia
    model_list = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
    ]

    return model_list

def model_agent_rotator(used_history_model):
    """
    Fungsi ini memilih model AI yang akan digunakan untuk setiap agen.
    Saat ini, semua agen menggunakan model Gemini 3.5 Flash.
    """
    models = get_model_list()

    for model in models:
        if model not in used_history_model:
            return model