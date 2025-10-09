import requests
import json

def call_ollama(prompt, model="llama3.1:latest"):
    """
    Call Ollama API with the given prompt.
    Make sure Ollama is running locally (ollama serve)
    """
    url = "http://localhost:11434/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get('response', 'No response generated')
    except requests.exceptions.ConnectionError:
        return "❌ Error: Cannot connect to Ollama. Make sure Ollama is running (run 'ollama serve' in terminal)"
    except Exception as e:
        return f"❌ Error: {str(e)}"


def test_caption_to_comment():
    """
    Test a prompt that converts captions to comments using Ollama.
    """
    
    # Define your prompt template
    prompt_template = """
  
  Objective: Build community & engagement
  Tone: Warm, encouraging, supportive
  Content Style:\n• Casual and approachable
  • Positive reinforcement\n• Emoji usage
  • Short and sweet\nResult:
  ✅ High engagement & reach
  Read the ${caption}
  You are a thoughtful and friendly commentator who generates warm, uplifting, and engaging comments that make creators feel seen and appreciated.
    Your goal is to build connection and spark friendly dialogue in the comments section.
    Analysis Process:
    1. Identify the main emotion or message of the caption.y
    2. Reflect genuine appreciation or encouragement.
    3. Add a light personal touch or relatable reaction.
    4. Optionally include a friendly emoji or two (😊✨🙌❤️🔥💪).
    NO hashtags.\nRespond only with valid JSON. No introduction or explanation.
    Given the caption below—which may include bullet points, narratives, or multi-language sections—create a comment that:
    • Feels authentic and personal.
    • Spreads positivity and warmth.
    • Adds a small personal insight or supportive reaction.
    • Keeps a conversational and natural tone.
    • Optionally uses emojis to convey friendliness.
   
    Key Guidelines:\n\n• Keep it short and positive (10–40 words)
    • Use casual, real-world tone\n• Avoid sarcasm, negativity, or deep critique
    • Use emojis sparingly (1–3 max)
    • NO hashtags (ignore any from caption)
    • Show empathy and genuine interest
    NO em dashes (—) - use periods, commas, or other punctuation instead
    • Encourage continued sharing or conversation
    Output Format:\nGenerate one friendly comment based on this caption: \"{caption}\"/
    [\n  {\n    \"comment\": \"Your friendly reply here 😊\",\n    \"viralRate\": 90,\n    \"commentTokenCount\": 20\n  }\n]
    nOriginal Post: \"${caption}\""

"""

    print("=" * 60)
    print("Caption to Comment Prompt Tester (Ollama + llama3.1)")
    print("=" * 60)
    print("\nCurrent Prompt Template:")
    print("-" * 60)
    print(prompt_template)
    print("-" * 60)
    print("\nModel: llama3.1:latest")
    print("Make sure Ollama is running!")
    
    while True:
        print("\n")
        caption = input("Enter a caption (or 'quit' to exit): ").strip()
        
        if caption.lower() in ['quit', 'exit', 'q']:
            print("Goodbye!")
            break
        
        if not caption:
            print("⚠️  Please enter a valid caption!")
            continue
        
        # Create the final prompt by replacing {caption}
        final_prompt = prompt_template.replace("{caption}", caption)
        
        print("\n" + "=" * 60)
        print("FINAL PROMPT SENT TO OLLAMA:")
        print("=" * 60)
        print(final_prompt)
        print("=" * 60)
        
        print("\n⏳ Generating comment with llama3.1...")
        
        # Call Ollama API
        comment = call_ollama(final_prompt)
        
        print("\n✅ GENERATED COMMENT:")
        print("-" * 60)
        print(comment)
        print("-" * 60)


def test_with_custom_prompt():
    """
    Version that allows you to input a custom prompt template.
    """
    print("=" * 60)
    print("Caption to Comment Tester (Custom Prompt + Ollama)")
    print("=" * 60)
    
    print("\nEnter your prompt template (use {caption} as placeholder):")
    print("(Press Enter twice when done)\n")
    
    lines = []
    while True:
        line = input()
        if line == "" and lines and lines[-1] == "":
            lines.pop()
            break
        lines.append(line)
    
    prompt_template = "\n".join(lines)
    
    print("\nModel: llama3.1:latest")
    print("Make sure Ollama is running!")
    
    while True:
        print("\n")
        caption = input("Enter a caption (or 'quit' to exit): ").strip()
        
        if caption.lower() in ['quit', 'exit', 'q']:
            print("Goodbye!")
            break
        
        if not caption:
            print("⚠️  Please enter a valid caption!")
            continue
        
        final_prompt = prompt_template.replace("{caption}", caption)
        
        print("\n" + "=" * 60)
        print("FINAL PROMPT:")
        print("=" * 60)
        print(final_prompt)
        print("=" * 60)
        
        print("\n⏳ Generating comment with llama3.1...")
        comment = call_ollama(final_prompt)
        
        print("\n✅ GENERATED COMMENT:")
        print("-" * 60)
        print(comment)
        print("-" * 60)


if __name__ == "__main__":
    # Run the basic version
    test_caption_to_comment()
    
    # Or uncomment to run the custom prompt version:
    # test_with_custom_prompt()