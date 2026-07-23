const DEFAULT_REPLIES = [
  "That's interesting! Tell me more about that.",
  "I see what you mean. What else is on your mind?",
  "Hmm, I need to think about that. Can you elaborate?",
  "Thanks for sharing! I appreciate that.",
  "Interesting perspective! What makes you say that?",
  "I'm not sure I understand. Could you explain differently?",
  "That's a good point. I hadn't considered that before.",
  "You make a lot of sense. What do you think we should do?",
  "I agree with you on that. How are you feeling about things?",
  "Great question! Let me think about it...",
];

export function pickDefaultReply(): string {
  return DEFAULT_REPLIES[Math.floor(Math.random() * DEFAULT_REPLIES.length)]!;
}
