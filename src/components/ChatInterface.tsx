import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMessage } from "@/lib/supabase";
import { sendMessage, getMessages, subscribeToMessages } from "@/lib/chat-service";
import { ChatMessage, LoadingMessage } from "./ChatMessage";
import { ChatSidebar } from "./ChatSidebar";
import { Send, BookText, FileText, Settings } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { ModelSettings } from "./ModelSettings";
import { ModelSelector } from "./ModelSelector";

export function ChatInterface() {
  const [sessionId, setSessionId] = useState<string>(() => {
    // Get the session ID from localStorage (which is set on login)
    const savedSessionId = localStorage.getItem("currentSessionId");
    return savedSessionId || uuidv4();
  });
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatModel, setChatModel] = useState<"OpenAI" | "Anthropic">("OpenAI");
  const [modelVersion, setModelVersion] = useState<string>("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (chatModel === "OpenAI") {
      setModelVersion("gpt-4o");
    } else if (chatModel === "Anthropic") {
      setModelVersion("claude-3-7-sonnet-20250219");
    }
  }, [chatModel]);
  
  useEffect(() => {
    const loadMessages = async () => {
      const messagesData = await getMessages(sessionId);
      setMessages(messagesData);
    };
    
    loadMessages();
    
    // Save the current session ID to localStorage
    localStorage.setItem("currentSessionId", sessionId);
    
    const subscription = subscribeToMessages(sessionId, (newMessage) => {
      // Only add AI messages from the subscription
      // User messages are added directly in the handleSendMessage function
      if (newMessage.message.type === "ai") {
        setMessages((prev) => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
      setIsLoading(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);
  
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;
    
    const userMessageObj: UserMessage = {
      id: uuidv4(),
      session_id: sessionId,
      message: {
        content: inputValue,
        type: "human"
      }
    };
    
    // Add the user message to the messages state
    setMessages(prev => [...prev, userMessageObj]);
    
    setInputValue("");
    setIsLoading(true);
    
    const modelParams: Record<string, string> = {};
    if (chatModel === "OpenAI") {
      modelParams.openaiModel = modelVersion;
    } else if (chatModel === "Anthropic") {
      modelParams.anthropicModel = modelVersion;
    }
    
    const success = await sendMessage(inputValue, sessionId, chatModel, modelParams);
    
    if (!success) {
      setIsLoading(false);
      toast.error("Failed to send message. Please try again.");
    }
  };
  
  const handleNewConversation = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setMessages([]);
  };
  
  const handleSessionSelect = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
  };

  const handlePromptShortcut = (promptTemplate: string) => {
    if (isLoading) return;
    setInputValue(promptTemplate);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const isNewConversation = messages.length === 0;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ChatSidebar 
        activeSessionId={sessionId} 
        onSelectSession={handleSessionSelect}
        onNewConversation={handleNewConversation}
      />
      
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl font-semibold">Growth Stage Marketing AI</h2>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-full"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {isNewConversation ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md w-full">
                  <h2 className="text-2xl font-bold mb-2 text-foreground/80">GSM Custom GPT</h2>
                  <p className="text-muted-foreground mb-6">Start a conversation with your AI assistant</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2" 
                      onClick={() => handlePromptShortcut("Create a comprehensive blog post about the following topic: ")}
                    >
                      <BookText className="h-4 w-4" />
                      Create a blog post
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2" 
                      onClick={() => handlePromptShortcut("Create a detailed whitepaper on the following subject: ")}
                    >
                      <FileText className="h-4 w-4" />
                      Create a whitepaper
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            
            {isLoading && <LoadingMessage />}
            
            <div ref={messageEndRef} />
          </div>
        </div>
        
        <div className={`p-4 transition-all duration-300 w-full ${isNewConversation ? 'absolute bottom-0 left-0 right-0 flex justify-center' : 'border-t border-border'}`}>
          <div className={`relative ${isNewConversation ? 'w-full max-w-xl mx-auto' : 'w-full max-w-4xl mx-auto'}`}>
            <form 
              onSubmit={handleSendMessage} 
              className="flex flex-col w-full"
            >
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                    <ModelSelector
                      chatModel={chatModel}
                      setChatModel={setChatModel}
                      modelVersion={modelVersion}
                      setModelVersion={setModelVersion}
                      compact={true}
                    />
                  </div>
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-background border-border focus-visible:ring-primary rounded-xl py-6 pl-[120px]"
                    disabled={isLoading}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isLoading || !inputValue.trim()}
                  className="transition-all duration-200 ease-in-out"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <ModelSettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        chatModel={chatModel}
        setChatModel={setChatModel}
      />
    </div>
  );
}
