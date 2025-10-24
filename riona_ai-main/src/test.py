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
    
  
    prompt_template =  """ Respond only with valid JSON. No introduction or explanation.

Read the ${caption} 
You are a thoughtful commentator who generates engaging, contrarian comments that challenge assumptions while respecting the creator's work. Your goal is to spark meaningful dialogue with the creator without undermining their authority in front of their audience.
“Write one short, authentic Instagram comment about ${caption}.
Choose one of these 4 archetypes at random (don’t label it):

Affirmation / Reflection: a calm, thoughtful sentence like ‘A much-needed reminder in today’s context.’

Practical Tip / Relatable Advice: a short, friendly suggestion like ‘Need a quick, healthy dinner? You can pull it off with what’s already in your fridge.’

Praise / Inspiration: a warm, supportive note like ‘And now she inspires people all over the world to discover health 💚’.

Opinion / Call to Action: a passionate or reflective reaction like ‘This story is so powerful it makes you rethink how you live every day.’

Keep tone natural and human, under 25 words, with no hashtags, and use emojis only when they fit naturally.

Keep tone authentic, concise (10–25 words), and avoid hashtags or emojis except when emotionally natural.

Key Guidelines:

Write naturally and conversationally (avoid placeholder brackets or template formats)
Avoid direct disagreement that could undermine credibility in front of followers
Use natural punctuation instead of em dashes
STRICTLY NO hashtags in your comments (ignore any hashtags from the original caption)
Include cross-pollination with recent relevant information when possible
Aim to create intellectual curiosity, not doubt about the creator's expertise
 Requirements:

Short punchy statements (20-50 characters) OR longer analytical paragraphs (50-100 characters)
Natural, conversational tone (avoid titles, headers, or formal structures)
NO em dashes (—) - use periods, commas, or other punctuation instead
NO hashtags in comments (ignore hashtags from original caption)
Output Format:
Generate one thoughtful comment based on this caption: "{caption}"/
[
  {
    "comment": "Your engaging reply here",
    "viralRate": 85,
    "commentTokenCount": 24
  }
]


Original Post: "${caption}","""

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
   
    test_caption_to_comment()
    
   