import Textarea from '@/components/ui/Textarea'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useCallback, useEffect, useRef, useState } from 'react'
import { throttle } from '@/lib/utils'
import { queryText, queryTextStream, queryData, generateKGReasoning, KnowledgeInsights } from '@/api/lightrag'
import { errorMessage } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { useDebounce } from '@/hooks/useDebounce'
import QuerySettings from '@/components/retrieval/QuerySettings'
import { ChatMessage, MessageWithError } from '@/components/retrieval/ChatMessage'
import { EraserIcon, SendIcon, CopyIcon, GitForkIcon, SlidersHorizontalIcon, SparklesIcon, PanelRightCloseIcon, PanelRightOpenIcon, DownloadIcon } from 'lucide-react'
import { buildExportHtml, downloadHtml } from '@/lib/exportConversation'
import { KnowledgeInsightsPanel } from '@/components/retrieval/KnowledgeInsightsPanel'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/utils/clipboard'
import type { QueryMode } from '@/api/lightrag'

// Helper function to generate unique IDs with browser compatibility
const generateUniqueId = () => {
  // Use crypto.randomUUID() if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback to timestamp + random string for browsers without crypto.randomUUID
  return `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// LaTeX completeness detection function
const detectLatexCompleteness = (content: string): boolean => {
  // Check for unclosed block-level LaTeX formulas ($$...$$)
  const blockLatexMatches = content.match(/\$\$/g) || []
  const hasUnclosedBlock = blockLatexMatches.length % 2 !== 0

  // Check for unclosed inline LaTeX formulas ($...$, but not $$)
  // Remove all block formulas first to avoid interference
  const contentWithoutBlocks = content.replace(/\$\$[\s\S]*?\$\$/g, '')
  const inlineLatexMatches = contentWithoutBlocks.match(/(?<!\$)\$(?!\$)/g) || []
  const hasUnclosedInline = inlineLatexMatches.length % 2 !== 0

  // LaTeX is complete if there are no unclosed formulas
  return !hasUnclosedBlock && !hasUnclosedInline
}

// Robust COT parsing function to handle multiple think blocks and edge cases
const parseCOTContent = (content: string) => {
  const thinkStartTag = '<think>'
  const thinkEndTag = '</think>'

  // Find all <think> and </think> tag positions
  const startMatches: number[] = []
  const endMatches: number[] = []

  let startIndex = 0
  while ((startIndex = content.indexOf(thinkStartTag, startIndex)) !== -1) {
    startMatches.push(startIndex)
    startIndex += thinkStartTag.length
  }

  let endIndex = 0
  while ((endIndex = content.indexOf(thinkEndTag, endIndex)) !== -1) {
    endMatches.push(endIndex)
    endIndex += thinkEndTag.length
  }

  // Analyze COT state
  const hasThinkStart = startMatches.length > 0
  const hasThinkEnd = endMatches.length > 0
  const isThinking = hasThinkStart && (startMatches.length > endMatches.length)

  let thinkingContent = ''
  let displayContent = content

  if (hasThinkStart) {
    if (hasThinkEnd && startMatches.length === endMatches.length) {
      // Complete thinking blocks: extract the last complete thinking content
      const lastStartIndex = startMatches[startMatches.length - 1]
      const lastEndIndex = endMatches[endMatches.length - 1]

      if (lastEndIndex > lastStartIndex) {
        thinkingContent = content.substring(
          lastStartIndex + thinkStartTag.length,
          lastEndIndex
        ).trim()

        // Remove all thinking blocks, keep only the final display content
        displayContent = content.substring(lastEndIndex + thinkEndTag.length).trim()
      }
    } else if (isThinking) {
      // Currently thinking: extract current thinking content
      const lastStartIndex = startMatches[startMatches.length - 1]
      thinkingContent = content.substring(lastStartIndex + thinkStartTag.length)
      displayContent = ''
    }
  }

  return {
    isThinking,
    thinkingContent,
    displayContent,
    hasValidThinkBlock: hasThinkStart && hasThinkEnd && startMatches.length === endMatches.length
  }
}

export default function RetrievalTesting() {
  const { t } = useTranslation()
  // Get current tab to determine if this tab is active (for performance optimization)
  const currentTab = useSettingsStore.use.currentTab()
  const isRetrievalTabActive = currentTab === 'retrieval'
  const queryMode = useSettingsStore((s) => s.querySettings.mode)

  const [messages, setMessages] = useState<MessageWithError[]>(() => {
    try {
      const history = useSettingsStore.getState().retrievalHistory || []
      // Ensure each message from history has a unique ID and mermaidRendered status
      return history.map((msg, index) => {
        try {
          const msgWithError = msg as MessageWithError // Cast to access potential properties
          return {
            ...msg,
            id: msgWithError.id || `hist-${Date.now()}-${index}`, // Add ID if missing
            mermaidRendered: msgWithError.mermaidRendered ?? true, // Assume historical mermaid is rendered
            latexRendered: msgWithError.latexRendered ?? true // Assume historical LaTeX is rendered
          }
        } catch (error) {
          console.error('Error processing message:', error)
          // Return a default message if there's an error
          return {
            role: 'system',
            content: 'Error loading message',
            id: `error-${Date.now()}-${index}`,
            isError: true,
            mermaidRendered: true
          }
        }
      })
    } catch (error) {
      console.error('Error loading history:', error)
      return [] // Return an empty array if there's an error
    }
  })
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [inputError, setInputError] = useState('')
  const [latestInsights, setLatestInsights] = useState<KnowledgeInsights | null>(null)
  const [latestIsGeneratingReasoning, setLatestIsGeneratingReasoning] = useState(false)
  const [rightTab, setRightTab] = useState<'settings' | 'insights'>('settings')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [exportTheme, setExportTheme] = useState<'light' | 'dark'>('light')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Smart switching logic: use Input for single line, Textarea for multi-line
  const hasMultipleLines = inputValue.includes('\n')

  // Enhanced event handlers for smart switching
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (inputError) setInputError('')
  }, [inputError])

  // Unified height adjustment function for textarea
  const adjustTextareaHeight = useCallback((element: HTMLTextAreaElement) => {
    requestAnimationFrame(() => {
      element.style.height = 'auto'
      element.style.height = Math.min(element.scrollHeight, 120) + 'px'
    })
  }, [])

  // Scroll to bottom function - restored smooth scrolling with better handling
  const scrollToBottom = useCallback(() => {
    // Set flag to indicate this is a programmatic scroll
    programmaticScrollRef.current = true
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        // Use smooth scrolling for better user experience
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      // Parse query mode prefix
      const allowedModes: QueryMode[] = ['naive', 'local', 'global', 'hybrid', 'mix', 'bypass']
      const prefixMatch = inputValue.match(/^\/(\w+)\s+([\s\S]+)/)
      let modeOverride: QueryMode | undefined = undefined
      let actualQuery = inputValue

      // If input starts with a slash, but does not match the valid prefix pattern, treat as error
      if (/^\/\S+/.test(inputValue) && !prefixMatch) {
        setInputError(t('retrievePanel.retrieval.queryModePrefixInvalid'))
        return
      }

      if (prefixMatch) {
        const mode = prefixMatch[1] as QueryMode
        const query = prefixMatch[2]
        if (!allowedModes.includes(mode)) {
          setInputError(
            t('retrievePanel.retrieval.queryModeError', {
              modes: 'naive, local, global, hybrid, mix, bypass',
            })
          )
          return
        }
        modeOverride = mode
        actualQuery = query
      }

      // Clear error message
      setInputError('')

      // Reset thinking timer state for new query to prevent confusion
      thinkingStartTime.current = null
      thinkingProcessed.current = false

      // Create messages
      // Save the original input (with prefix if any) in userMessage.content for display
      const userMessage: MessageWithError = {
        id: generateUniqueId(), // Use browser-compatible ID generation
        content: inputValue,
        role: 'user'
      }

      const assistantMessage: MessageWithError = {
        id: generateUniqueId(), // Use browser-compatible ID generation
        content: '',
        role: 'assistant',
        mermaidRendered: false,
        latexRendered: false,      // Explicitly initialize to false
        thinkingTime: null,        // Explicitly initialize to null
        thinkingContent: undefined, // Explicitly initialize to undefined
        displayContent: undefined,  // Explicitly initialize to undefined
        isThinking: false          // Explicitly initialize to false
      }

      const prevMessages = [...messages]

      // Add messages to chatbox
      setMessages([...prevMessages, userMessage, assistantMessage])

      // Reset scroll following state for new query
      shouldFollowScrollRef.current = true
      // Set flag to indicate we're receiving a response
      isReceivingResponseRef.current = true

      // Force scroll to bottom after messages are rendered
      setTimeout(() => {
        scrollToBottom()
      }, 0)

      // Clear input and set loading
      setInputValue('')
      setIsLoading(true)

      // Reset input height to minimum after clearing input
      if (inputRef.current) {
        if ('style' in inputRef.current) {
          inputRef.current.style.height = '40px'
        }
      }

      // Create a function to update the assistant's message
      const updateAssistantMessage = (chunk: string, isError?: boolean) => {
        assistantMessage.content += chunk

        // Start thinking timer on first sight of think tag
        if (assistantMessage.content.includes('<think>') && !thinkingStartTime.current) {
          thinkingStartTime.current = Date.now()
        }

        // Use the new robust COT parsing function
        const cotResult = parseCOTContent(assistantMessage.content)

        // Update thinking state
        assistantMessage.isThinking = cotResult.isThinking

        // Only calculate time and extract thinking content once when thinking is complete
        if (cotResult.hasValidThinkBlock && !thinkingProcessed.current) {
          if (thinkingStartTime.current && !assistantMessage.thinkingTime) {
            const duration = (Date.now() - thinkingStartTime.current) / 1000
            assistantMessage.thinkingTime = parseFloat(duration.toFixed(2))
          }
          thinkingProcessed.current = true
        }

        // Update content based on parsing results
        assistantMessage.thinkingContent = cotResult.thinkingContent
        // Only fallback to full content if not in a thinking state.
        if (cotResult.isThinking) {
          assistantMessage.displayContent = ''
        } else {
          assistantMessage.displayContent = cotResult.displayContent || assistantMessage.content
        }

        // Detect if the assistant message contains a complete mermaid code block
        // Simple heuristic: look for ```mermaid ... ```
        const mermaidBlockRegex = /```mermaid\s+([\s\S]+?)```/g
        let mermaidRendered = false
        let match
        while ((match = mermaidBlockRegex.exec(assistantMessage.content)) !== null) {
          // If the block is not too short, consider it complete
          if (match[1] && match[1].trim().length > 10) {
            mermaidRendered = true
            break
          }
        }
        assistantMessage.mermaidRendered = mermaidRendered

        // Detect if the assistant message contains complete LaTeX formulas
        const latexRendered = detectLatexCompleteness(assistantMessage.content)
        assistantMessage.latexRendered = latexRendered

        // Single unified update to avoid race conditions
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage && lastMessage.id === assistantMessage.id) {
            // Update all properties at once to maintain consistency
            Object.assign(lastMessage, {
              content: assistantMessage.content,
              thinkingContent: assistantMessage.thinkingContent,
              displayContent: assistantMessage.displayContent,
              isThinking: assistantMessage.isThinking,
              isError: isError,
              mermaidRendered: assistantMessage.mermaidRendered,
              latexRendered: assistantMessage.latexRendered,
              thinkingTime: assistantMessage.thinkingTime
            })
          }
          return newMessages
        })

        // After updating content, scroll to bottom if auto-scroll is enabled
        // Use a longer delay to ensure DOM has updated
        if (shouldFollowScrollRef.current) {
          setTimeout(() => {
            scrollToBottom()
          }, 30)
        }
      }

      // Prepare query parameters
      const state = useSettingsStore.getState()

      // Add user prompt to history if it exists and is not empty
      if (state.querySettings.user_prompt && state.querySettings.user_prompt.trim()) {
        state.addUserPromptToHistory(state.querySettings.user_prompt.trim())
      }

      // Determine the effective mode
      const effectiveMode = modeOverride || state.querySettings.mode

      // Determine effective history turns with bypass override
      const configuredHistoryTurns = state.querySettings.history_turns || 0
      const effectiveHistoryTurns = (effectiveMode === 'bypass' && configuredHistoryTurns === 0)
        ? 3
        : configuredHistoryTurns

      const queryParams = {
        ...state.querySettings,
        query: actualQuery,
        response_type: 'Multiple Paragraphs',
        conversation_history: effectiveHistoryTurns > 0
          ? prevMessages
            .filter((m) => m.isError !== true)
            .slice(-effectiveHistoryTurns * 2)
            .map((m) => ({ role: m.role, content: m.content }))
          : [],
        ...(modeOverride ? { mode: modeOverride } : {})
      }

      try {
        // Run query
        if (state.querySettings.stream) {
          let errorMessage = ''
          await queryTextStream(
            queryParams,
            updateAssistantMessage,
            (error) => {
              errorMessage += error
            },
            (references) => {
              // Add references/citations to the assistant message
              if (references && references.length > 0) {
                assistantMessage.references = references
              }
            }
          )
          if (errorMessage) {
            if (assistantMessage.content) {
              errorMessage = assistantMessage.content + '\n' + errorMessage
            }
            updateAssistantMessage(errorMessage, true)
          }
        } else {
          const response = await queryText(queryParams)
          updateAssistantMessage(response.response)
          // Add references/citations to the assistant message
          if (response.references && response.references.length > 0) {
            assistantMessage.references = response.references
          }
        }

        // Fetch Knowledge Graph insights if enabled
        const enableKGInsights = useSettingsStore.getState().enableKGInsights
        const enableKGReasoning = useSettingsStore.getState().enableKGReasoning

        if (enableKGInsights && effectiveMode !== 'bypass') {
          try {
            // Fetch structured data from /query/data endpoint
            const dataResponse = await queryData({
              ...queryParams,
              stream: false  // Data endpoint doesn't support streaming
            })

            if (dataResponse.status === 'success' && dataResponse.data) {
              // Build knowledge insights object
              const insights: KnowledgeInsights = {
                entities: dataResponse.data.entities || [],
                relationships: dataResponse.data.relationships || [],
                keywords: dataResponse.metadata?.keywords || { high_level: [], low_level: [] },
                processingInfo: dataResponse.metadata?.processing_info || {},
                chunks: dataResponse.data.chunks || []
              }

              // Update message with insights
              assistantMessage.knowledgeInsights = insights

              // Update UI immediately with basic insights
              setMessages((prev) => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage && lastMessage.id === assistantMessage.id) {
                  lastMessage.knowledgeInsights = insights
                }
                return newMessages
              })

              // Persist insights to history immediately
              useSettingsStore.getState().setRetrievalHistory([...prevMessages, userMessage, assistantMessage])

              // Show in right panel and switch to Insights tab
              setLatestInsights(insights)
              setActiveMessageId(assistantMessage.id || null)
              setRightTab('insights')

              // Generate LLM reasoning if enabled
              if (enableKGReasoning && (insights.entities.length > 0 || insights.relationships.length > 0)) {
                // Mark as generating reasoning
                assistantMessage.isGeneratingReasoning = true
                setLatestIsGeneratingReasoning(true)
                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.id === assistantMessage.id) {
                    lastMessage.isGeneratingReasoning = true
                  }
                  return newMessages
                })

                try {
                  const reasoning = await generateKGReasoning(
                    insights.entities,
                    insights.relationships,
                    insights.keywords,
                    actualQuery
                  )

                  if (reasoning) {
                    assistantMessage.knowledgeInsights = {
                      ...insights,
                      reasoning
                    }

                    setMessages((prev) => {
                      const newMessages = [...prev]
                      const lastMessage = newMessages[newMessages.length - 1]
                      if (lastMessage && lastMessage.id === assistantMessage.id) {
                        lastMessage.knowledgeInsights = { ...insights, reasoning }
                        lastMessage.isGeneratingReasoning = false
                      }
                      return newMessages
                    })

                    // Persist reasoning to history
                    useSettingsStore.getState().setRetrievalHistory([...prevMessages, userMessage, assistantMessage])

                    // Update right panel with reasoning
                    setLatestInsights({ ...insights, reasoning })
                    setLatestIsGeneratingReasoning(false)
                  }
                } catch (reasoningError) {
                  console.error('Failed to generate KG reasoning:', reasoningError)
                  setLatestIsGeneratingReasoning(false)
                } finally {
                  assistantMessage.isGeneratingReasoning = false
                  setLatestIsGeneratingReasoning(false)
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.id === assistantMessage.id) {
                      lastMessage.isGeneratingReasoning = false
                    }
                    return newMessages
                  })
                }
              }
            }
          } catch (insightsError) {
            console.error('Failed to fetch KG insights:', insightsError)
            // Don't fail the main query if insights fail
          }
        }
      } catch (err) {
        // Handle error
        updateAssistantMessage(`${t('retrievePanel.retrieval.error')}\n${errorMessage(err)}`, true)
      } finally {
        // Clear loading and add messages to state
        setIsLoading(false)
        isReceivingResponseRef.current = false

        // Enhanced cleanup with error handling to prevent memory leaks
        try {
          // Final COT state validation and cleanup
          const finalCotResult = parseCOTContent(assistantMessage.content)

          // Force set final state - stream ended so thinking must be false
          assistantMessage.isThinking = false

          // If we have a complete thinking block but time wasn't calculated, do final calculation
          if (finalCotResult.hasValidThinkBlock && thinkingStartTime.current && !assistantMessage.thinkingTime) {
            const duration = (Date.now() - thinkingStartTime.current) / 1000
            assistantMessage.thinkingTime = parseFloat(duration.toFixed(2))
          }

          // Ensure display content is correctly set based on final parsing
          if (finalCotResult.displayContent !== undefined) {
            assistantMessage.displayContent = finalCotResult.displayContent
          }

        } catch (error) {
          console.error('Error in final COT state validation:', error)
          // Force reset state on error
          assistantMessage.isThinking = false
        } finally {
          // Ensure cleanup happens regardless of errors
          thinkingStartTime.current = null
        }

        // Save history with error handling
        try {
          useSettingsStore
            .getState()
            .setRetrievalHistory([...prevMessages, userMessage, assistantMessage])
        } catch (error) {
          console.error('Error saving retrieval history:', error)
        }
      }
    },
    [inputValue, isLoading, messages, setMessages, t, scrollToBottom]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: Insert newline
      e.preventDefault()
      const target = e.target as HTMLInputElement | HTMLTextAreaElement
      const start = target.selectionStart || 0
      const end = target.selectionEnd || 0
      const newValue = inputValue.slice(0, start) + '\n' + inputValue.slice(end)
      setInputValue(newValue)

      // Set cursor position after the newline and adjust height if needed
      setTimeout(() => {
        if (target.setSelectionRange) {
          target.setSelectionRange(start + 1, start + 1)
        }

        // Manually trigger height adjustment for textarea after component switch
        if (inputRef.current && inputRef.current.tagName === 'TEXTAREA') {
          adjustTextareaHeight(inputRef.current as HTMLTextAreaElement)
        }
      }, 0)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter: Submit form
      e.preventDefault()
      handleSubmit(e as any)
    }
  }, [inputValue, handleSubmit, adjustTextareaHeight])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Get pasted text content
    const pastedText = e.clipboardData.getData('text')

    // Check if it contains newlines
    if (pastedText.includes('\n')) {
      e.preventDefault() // Prevent default paste behavior

      // Get current cursor position
      const target = e.target as HTMLInputElement | HTMLTextAreaElement
      const start = target.selectionStart || 0
      const end = target.selectionEnd || 0

      // Build new value
      const newValue = inputValue.slice(0, start) + pastedText + inputValue.slice(end)

      // Update state (this will trigger component switch to Textarea)
      setInputValue(newValue)

      // Set cursor position to end of pasted content
      setTimeout(() => {
        if (inputRef.current && inputRef.current.setSelectionRange) {
          const newCursorPosition = start + pastedText.length
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
        }
      }, 0)
    }
    // If no newlines, let default paste behavior continue
  }, [inputValue])

  // Effect to handle component switching and maintain focus
  useEffect(() => {
    if (inputRef.current) {
      // When component type changes, restore focus and cursor position
      const currentElement = inputRef.current
      const cursorPosition = currentElement.selectionStart || inputValue.length

      // Use requestAnimationFrame to ensure DOM update is complete
      requestAnimationFrame(() => {
        currentElement.focus()
        if (currentElement.setSelectionRange) {
          currentElement.setSelectionRange(cursorPosition, cursorPosition)
        }
      })
    }
  }, [hasMultipleLines, inputValue.length]) // Include inputValue.length dependency

  // Effect to adjust textarea height when switching to multi-line mode
  useEffect(() => {
    if (hasMultipleLines && inputRef.current && inputRef.current.tagName === 'TEXTAREA') {
      adjustTextareaHeight(inputRef.current as HTMLTextAreaElement)
    }
  }, [hasMultipleLines, inputValue, adjustTextareaHeight])

  // Reference to track if we should follow scroll during streaming (using ref for synchronous updates)
  const shouldFollowScrollRef = useRef(true)
  const thinkingStartTime = useRef<number | null>(null)
  const thinkingProcessed = useRef(false)
  // Reference to track if user interaction is from the form area
  const isFormInteractionRef = useRef(false)
  // Reference to track if scroll was triggered programmatically
  const programmaticScrollRef = useRef(false)
  // Reference to track if we're currently receiving a streaming response
  const isReceivingResponseRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Add cleanup effect for memory leak prevention
  useEffect(() => {
    // Component cleanup - reset timer state to prevent memory leaks
    return () => {
      if (thinkingStartTime.current) {
        thinkingStartTime.current = null;
      }
    };
  }, []);

  // Add event listeners to detect when user manually interacts with the container
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Handle significant mouse wheel events - only disable auto-scroll for deliberate scrolling
    const handleWheel = (e: WheelEvent) => {
      // Only consider significant wheel movements (more than 10px)
      if (Math.abs(e.deltaY) > 10 && !isFormInteractionRef.current) {
        shouldFollowScrollRef.current = false;
      }
    };

    // Handle scroll events - only disable auto-scroll if not programmatically triggered
    // and if it's a significant scroll
    const handleScroll = throttle(() => {
      // If this is a programmatic scroll, don't disable auto-scroll
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }

      // Check if scrolled to bottom or very close to bottom
      const container = messagesContainerRef.current;
      if (container) {
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 20;

        // If at bottom, enable auto-scroll, otherwise disable it
        if (isAtBottom) {
          shouldFollowScrollRef.current = true;
        } else if (!isFormInteractionRef.current && !isReceivingResponseRef.current) {
          shouldFollowScrollRef.current = false;
        }
      }
    }, 30);

    // Add event listeners - only listen for wheel and scroll events
    container.addEventListener('wheel', handleWheel as EventListener);
    container.addEventListener('scroll', handleScroll as EventListener);

    return () => {
      container.removeEventListener('wheel', handleWheel as EventListener);
      container.removeEventListener('scroll', handleScroll as EventListener);
    };
  }, []);

  // Add event listeners to the form area to prevent disabling auto-scroll when interacting with form
  useEffect(() => {
    const form = document.querySelector('form');
    if (!form) return;

    const handleFormMouseDown = () => {
      // Set flag to indicate form interaction
      isFormInteractionRef.current = true;

      // Reset the flag after a short delay
      setTimeout(() => {
        isFormInteractionRef.current = false;
      }, 500); // Give enough time for the form interaction to complete
    };

    form.addEventListener('mousedown', handleFormMouseDown);

    return () => {
      form.removeEventListener('mousedown', handleFormMouseDown);
    };
  }, []);

  // Use a longer debounce time for better performance with large message updates
  const debouncedMessages = useDebounce(messages, 150)
  useEffect(() => {
    // Only auto-scroll if enabled
    if (shouldFollowScrollRef.current) {
      // Force scroll to bottom when messages change
      scrollToBottom()
    }
  }, [debouncedMessages, scrollToBottom])


  const clearMessages = useCallback(() => {
    setMessages([])
    useSettingsStore.getState().setRetrievalHistory([])
  }, [setMessages])

  // Handle copying message content with robust clipboard support
  const handleCopyMessage = useCallback(async (message: MessageWithError) => {
    let contentToCopy = '';

    if (message.role === 'user') {
      // User messages: copy original content
      contentToCopy = message.content || '';
    } else {
      // Assistant messages: prefer processed display content, fallback to original content
      const finalDisplayContent = message.displayContent !== undefined
        ? message.displayContent
        : (message.content || '');
      contentToCopy = finalDisplayContent;
    }

    if (!contentToCopy.trim()) {
      toast.error(t('retrievePanel.chatMessage.copyEmpty', 'No content to copy'));
      return;
    }

    try {
      const result = await copyToClipboard(contentToCopy);

      if (result.success) {
        // Show success message with method used
        const methodMessages: Record<string, string> = {
          'clipboard-api': t('retrievePanel.chatMessage.copySuccess', 'Content copied to clipboard'),
          'execCommand': t('retrievePanel.chatMessage.copySuccessLegacy', 'Content copied (legacy method)'),
          'manual-select': t('retrievePanel.chatMessage.copySuccessManual', 'Content copied (manual method)'),
          'fallback': t('retrievePanel.chatMessage.copySuccess', 'Content copied to clipboard')
        };

        toast.success(methodMessages[result.method] || t('retrievePanel.chatMessage.copySuccess', 'Content copied to clipboard'));
      } else {
        // Show error with fallback instructions
        if (result.method === 'fallback') {
          toast.error(
            result.error || t('retrievePanel.chatMessage.copyFailed', 'Failed to copy content'),
            {
              description: t('retrievePanel.chatMessage.copyManualInstruction', 'Please select and copy the text manually')
            }
          );
        } else {
          toast.error(
            t('retrievePanel.chatMessage.copyFailed', 'Failed to copy content'),
            {
              description: result.error
            }
          );
        }
      }
    } catch (err) {
      console.error('Clipboard operation failed:', err);
      toast.error(
        t('retrievePanel.chatMessage.copyError', 'Copy operation failed'),
        {
          description: err instanceof Error ? err.message : 'Unknown error occurred'
        }
      );
    }
  }, [t])

  // Load insights for a clicked message pair
  const handleMessageClick = useCallback((message: MessageWithError) => {
    // For user messages, find the next assistant message; for assistant messages use directly
    const msgs = useSettingsStore.getState().retrievalHistory as MessageWithError[]
    const all = messages
    let target: MessageWithError | undefined

    if (message.role === 'user') {
      const idx = all.findIndex((m) => m.id === message.id)
      target = all.slice(idx + 1).find((m) => m.role === 'assistant')
    } else {
      target = message
    }

    if (target?.knowledgeInsights) {
      setLatestInsights(target.knowledgeInsights)
      setActiveMessageId(target.id || null)
      setRightTab('insights')
    }
  }, [messages])

  return (
    <div className="lumen-field flex size-full gap-4 px-4 pt-2 pb-14 overflow-hidden">
      <div className="flex grow flex-col gap-3">
        {/* Conversation surface — frosted glass over the ambient field */}
        <div className="relative grow">
          <div
            ref={messagesContainerRef}
            className="lumen-glass absolute inset-0 flex flex-col overflow-auto rounded-[22px] p-3"
            onClick={() => {
              if (shouldFollowScrollRef.current) {
                shouldFollowScrollRef.current = false
              }
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {messages.length === 0 ? (
                <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="text-lg font-medium">{t('retrievePanel.retrieval.startPrompt')}</span>
                  <span className="text-xs opacity-70">
                    {t('retrievePanel.retrieval.placeholder')}
                  </span>
                </div>
              ) : (
                messages.map((message) => {
                  // Determine if this message pair is the active one
                  const assistantId = message.role === 'assistant' ? message.id : null
                  const isActive = assistantId
                    ? activeMessageId === assistantId
                    : messages.slice(messages.findIndex(m => m.id === message.id) + 1).find(m => m.role === 'assistant')?.id === activeMessageId
                  const hasInsights = message.role === 'assistant'
                    ? !!message.knowledgeInsights
                    : !!messages.slice(messages.findIndex(m => m.id === message.id) + 1).find(m => m.role === 'assistant')?.knowledgeInsights

                  return (
                  <div
                    key={message.id}
                    className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2 rounded-xl transition-colors ${isActive ? 'bg-primary/5' : ''} ${hasInsights ? 'cursor-pointer' : ''}`}
                    onClick={() => hasInsights && handleMessageClick(message)}
                    title={hasInsights ? 'Click to view insights' : undefined}
                  >
                    {message.role === 'user' && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(message) }}
                        className="mb-2 size-6 rounded-md opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 shrink-0"
                        tooltip={t('retrievePanel.chatMessage.copyTooltip')}
                        variant="ghost"
                        size="icon"
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                    )}
                    <ChatMessage message={message} isTabActive={isRetrievalTabActive} />
                    {message.role === 'assistant' && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(message) }}
                        className="mb-2 size-6 rounded-md opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 shrink-0"
                        tooltip={t('retrievePanel.chatMessage.copyTooltip')}
                        variant="ghost"
                        size="icon"
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                  )
                })
              )}
              <div ref={messagesEndRef} className="pb-1" />
            </div>
          </div>
        </div>

        {/* Floating glass composer */}
        <form
          onSubmit={handleSubmit}
          className="lumen-glass flex shrink-0 items-center gap-2 rounded-[20px] p-2 pl-3"
          autoComplete="on"
          method="post"
          action="#"
          role="search"
        >
          <input type="submit" style={{ display: 'none' }} tabIndex={-1} />

          {/* Active query-mode pill */}
          <span className="hidden items-center gap-1.5 rounded-xl bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shrink-0 sm:inline-flex">
            <GitForkIcon className="size-3.5" />
            {queryMode}
          </span>

          <div className="relative flex-1">
            <label htmlFor="query-input" className="sr-only">
              {t('retrievePanel.retrieval.placeholder')}
            </label>
            {hasMultipleLines ? (
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                id="query-input"
                autoComplete="on"
                className="w-full min-h-[40px] max-h-[120px] overflow-y-auto border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t('retrievePanel.retrieval.placeholder')}
                disabled={isLoading}
                rows={1}
                style={{ resize: 'none', height: 'auto', minHeight: '40px', maxHeight: '120px' }}
                onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                  const target = e.target as HTMLTextAreaElement
                  requestAnimationFrame(() => {
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                  })
                }}
              />
            ) : (
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                id="query-input"
                autoComplete="on"
                className="w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t('retrievePanel.retrieval.placeholder')}
                disabled={isLoading}
              />
            )}
            {inputError && (
              <div className="absolute left-0 top-full mt-1 text-xs text-red-500">{inputError}</div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            size="icon"
            side="top"
            tooltip={sidebarOpen ? 'Hide panel' : 'Show panel'}
            className="rounded-xl text-muted-foreground shrink-0"
          >
            {sidebarOpen ? <PanelRightCloseIcon className="size-4" /> : <PanelRightOpenIcon className="size-4" />}
          </Button>
          {/* Export conversation */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setExportTheme('light')}
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-l border border-r-0 transition-colors ${exportTheme === 'light' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground'}`}
            >L</button>
            <button
              type="button"
              onClick={() => setExportTheme('dark')}
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-r border transition-colors ${exportTheme === 'dark' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground'}`}
            >D</button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            side="top"
            tooltip={`Export conversation (${exportTheme})`}
            className="rounded-xl text-muted-foreground shrink-0"
            onClick={() => {
              const html = buildExportHtml(messages, exportTheme)
              downloadHtml(html, `docforge-export-${exportTheme}.html`)
            }}
          >
            <DownloadIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={clearMessages}
            disabled={isLoading}
            size="icon"
            side="top"
            tooltip={t('retrievePanel.retrieval.clear')}
            className="rounded-xl text-muted-foreground shrink-0"
          >
            <EraserIcon className="size-4" />
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            size="icon"
            side="top"
            tooltip={t('retrievePanel.retrieval.send')}
            className="lumen-grad size-10 rounded-xl shrink-0"
          >
            <SendIcon className="size-4" />
          </Button>
        </form>
      </div>

      {/* Right panel — tabbed Settings / Insights */}
      {sidebarOpen && <div className="lumen-glass flex shrink-0 flex-col w-[300px] rounded-[20px] overflow-hidden">
        {/* Tab bar */}
        <div className="flex gap-0 border-b border-border/30 px-3 pt-3 shrink-0">
          <button
            onClick={() => setRightTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              rightTab === 'settings'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <SlidersHorizontalIcon className="w-3.5 h-3.5" />
            {t('retrievePanel.querySettings.parametersTitle', 'Settings')}
          </button>
          {latestInsights && (
            <button
              onClick={() => setRightTab('insights')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                rightTab === 'insights'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              {t('retrievePanel.insights.title', 'Insights')}
              {((latestInsights.entities?.length || 0) + (latestInsights.relationships?.length || 0)) > 0 && (
                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {(latestInsights.entities?.length || 0) + (latestInsights.relationships?.length || 0)}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden p-3">
          {rightTab === 'settings' && <QuerySettings />}
          {rightTab === 'insights' && latestInsights && (
            <KnowledgeInsightsPanel
              insights={latestInsights}
              isGeneratingReasoning={latestIsGeneratingReasoning}
            />
          )}
        </div>
      </div>}
    </div>
  )
}
