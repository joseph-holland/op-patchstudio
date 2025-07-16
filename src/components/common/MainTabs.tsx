import { useAppContext } from '../../context/AppContext';
import { DrumTool } from '../drum/DrumTool';
import { MultisampleTool } from '../multisample/MultisampleTool';
import { LibraryPage } from '../library/LibraryPage';

import { FEATURE_FLAGS } from '../../utils/constants';
import { scrapePatreonPosts, type PatreonPost } from '../../utils/patreonPosts';
import { useState, useEffect } from 'react';

export function MainTabs() {
  const { state, dispatch } = useAppContext();
  const [patreonPosts, setPatreonPosts] = useState<PatreonPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const handleTabChange = (tabName: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate') => {
    dispatch({ type: 'SET_TAB', payload: tabName });
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabName: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tabName);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const baseTabs = ['drum', 'multisample', 'library'] as const;
      const tabs = FEATURE_FLAGS.DONATE_PAGE ? [...baseTabs, 'donate', 'feedback'] : [...baseTabs, 'feedback'];
      const currentIndex = tabs.indexOf(state.currentTab as any);
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      handleTabChange(tabs[newIndex] as 'drum' | 'multisample' | 'feedback' | 'library' | 'donate');
    }
  };

  // Load Patreon posts when donate tab is selected
  useEffect(() => {
    if (state.currentTab === 'donate' && patreonPosts.length === 0 && !isLoadingPosts) {
      setIsLoadingPosts(true);
      scrapePatreonPosts()
        .then(posts => {
          setPatreonPosts(posts);
          setIsLoadingPosts(false);
        })
        .catch(error => {
          console.error('Failed to load Patreon posts:', error);
          setIsLoadingPosts(false);
        });
    }
  }, [state.currentTab, patreonPosts.length, isLoadingPosts]);

  const tabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderRadius: '15px 15px 0 0',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 1,
    outline: 'none',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle)'
  };

  const drumTabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderTopLeftRadius: '15px',
    borderTopRightRadius: '15px',
    borderBottomLeftRadius: '0',
    borderBottomRightRadius: '0',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 1,
    outline: 'none',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle)'
  } as React.CSSProperties;

  const activeDrumTabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderTopLeftRadius: '15px',
    borderTopRightRadius: '15px',
    borderBottomLeftRadius: '0',
    borderBottomRightRadius: '0',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-bg-primary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 2,
    marginBottom: '-1px',
    outline: 'none'
  };

  const activeTabStyle = {
    ...tabStyle,
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-bg-primary)',
    zIndex: 2,
    marginBottom: '-1px',
    outline: 'none'
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Custom Tab Navigation */}
      <div 
        role="tablist"
        aria-label="main navigation tabs"
        className="tab-bar"
        style={{ 
        display: 'flex',
        marginBottom: '0',
        borderBottom: '1px solid var(--color-border-subtle)',
        marginLeft: '16px',
        marginRight: '16px'
        }}
      >
        <button
          id="drum-tab"
          tabIndex={state.currentTab === 'drum' ? 0 : -1}
          aria-controls="drum-tabpanel"
          style={state.currentTab === 'drum' ? activeDrumTabStyle : drumTabStyle}
          onClick={() => handleTabChange('drum')}
          onKeyDown={(e) => handleKeyDown(e, 'drum')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'drum') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'drum') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          drum
        </button>
        <button
          id="multisample-tab"
          tabIndex={state.currentTab === 'multisample' ? 0 : -1}
          aria-controls="multisample-tabpanel"
          style={state.currentTab === 'multisample' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('multisample')}
          onKeyDown={(e) => handleKeyDown(e, 'multisample')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'multisample') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'multisample') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          multisample
        </button>
        <button
          id="library-tab"
          tabIndex={state.currentTab === 'library' ? 0 : -1}
          aria-controls="library-tabpanel"
          style={state.currentTab === 'library' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('library')}
          onKeyDown={(e) => handleKeyDown(e, 'library')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'library') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'library') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          library
        </button>
        {FEATURE_FLAGS.DONATE_PAGE && (
          <button
            id="donate-tab"
            tabIndex={state.currentTab === 'donate' ? 0 : -1}
            aria-controls="donate-tabpanel"
            style={state.currentTab === 'donate' ? activeTabStyle : tabStyle}
            onClick={() => handleTabChange('donate')}
            onKeyDown={(e) => handleKeyDown(e, 'donate')}
            onMouseEnter={(e) => {
              if (state.currentTab !== 'donate') {
                e.currentTarget.style.background = 'var(--color-border-subtle)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (state.currentTab !== 'donate') {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            donate
          </button>
        )}
        <button
          id="feedback-tab"
          tabIndex={state.currentTab === 'feedback' ? 0 : -1}
          aria-controls="feedback-tabpanel"
          style={state.currentTab === 'feedback' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('feedback')}
          onKeyDown={(e) => handleKeyDown(e, 'feedback')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'feedback') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'feedback') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          feedback
        </button>
      </div>
      
      {/* Tab Content */}
      {state.currentTab === 'drum' && (
        <div 
          role="tabpanel"
          id="drum-tabpanel"
          aria-labelledby="drum-tab"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            border: '1px solid var(--color-border-subtle)',
            borderTop: 'none',
            minHeight: '500px',
            overflow: 'hidden'
          }}
        >
          <DrumTool />
        </div>
      )}
      
      {state.currentTab === 'multisample' && (
        <div 
          role="tabpanel"
          id="multisample-tabpanel"
          aria-labelledby="multisample-tab"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            border: '1px solid var(--color-border-subtle)',
            borderTop: 'none',
            minHeight: '500px',
            overflow: 'hidden'
          }}
        >
          <MultisampleTool />
        </div>
      )}
      
      {state.currentTab === 'feedback' && (
        <div
          role="tabpanel"
          id="feedback-tabpanel"
          aria-labelledby="feedback-tab"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            border: '1px solid var(--color-border-subtle)',
            borderTop: 'none',
            minHeight: '500px',
            overflow: 'hidden'
          }}
        >
          {/* Feedback Section */}
          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px var(--color-shadow-primary)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
            marginBottom: '1rem',
            margin: '2rem'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.7rem 1rem 0.5rem 1rem',
              borderBottom: '1px solid var(--color-border-medium)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h3 style={{
                  margin: 0,
                  color: '#222',
                  fontSize: '1.25rem',
                  fontWeight: 300,
                }}>
                  feedback
                </h3>
              </div>
            </div>

            {/* Content */}
            <div style={{ 
              padding: '2rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true"
                  width="1200"
                  height="1000"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  style={{
                    border: 'none',
                    borderRadius: '15px',
                    maxWidth: '100%',
                    minHeight: '800px',
                    background: 'white'
                  }}
                >
                  loading…
                </iframe>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {state.currentTab === 'donate' && FEATURE_FLAGS.DONATE_PAGE && (
        <div
          role="tabpanel"
          id="donate-tabpanel"
          aria-labelledby="donate-tab"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            border: '1px solid var(--color-border-subtle)',
            borderTop: 'none',
            minHeight: '500px',
            overflow: 'hidden'
          }}
        >
          {/* Donate Section */}
          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px var(--color-shadow-primary)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
            marginBottom: '1rem',
            margin: '2rem'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.7rem 1rem 0.5rem 1rem',
              borderBottom: '1px solid var(--color-border-medium)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h3 style={{
                  margin: 0,
                  color: '#222',
                  fontSize: '1.25rem',
                  fontWeight: 300,
                }}>
                  support the project
                </h3>
              </div>
            </div>

            {/* Content */}
            <div style={{ 
              padding: '2rem',
            }}>
              <div style={{
                textAlign: 'center',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                  marginBottom: '2rem'
                }}>
                  support the development of OP-PatchStudio and get access to exclusive content, tutorials and early access to preview features still in development.<br/><br/>
                  join the community to get behind-the-scenes updates, voting rights on roadmap priorities and priority support for issues.<br/><br/>
                  your support helps cover the cost of ai coding tools and services i use that make rapid development of new features and support possible.
                </p>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'center'
                }}>
                  <a 
                    href="https://www.patreon.com/c/oppatchstudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem 2rem',
                      backgroundColor: 'var(--color-interactive-primary)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontWeight: '500',
                      fontSize: '1.1rem',
                      transition: 'background-color 0.2s ease',
                      minWidth: '200px',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-interactive-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-interactive-primary)';
                    }}
                  >
                    <i className="fab fa-patreon" style={{ fontSize: '1.2rem' }}></i>
                    support on patreon
                  </a>
                  
                  <a 
                    href="https://buymeacoffee.com/jxavierh"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem 2rem',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontWeight: '500',
                      fontSize: '1.1rem',
                      border: '1px solid var(--color-border-light)',
                      transition: 'background-color 0.2s ease',
                      minWidth: '200px',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                    }}
                  >
                    <i className="fas fa-coffee" style={{ fontSize: '1.2rem' }}></i>
                    buy me a coffee
                  </a>
                </div>
                

              </div>
            </div>
          </div>
          
          {/* Latest Posts Section */}
          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px var(--color-shadow-primary)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
            marginBottom: '1rem',
            margin: '2rem'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.7rem 1rem 0.5rem 1rem',
              borderBottom: '1px solid var(--color-border-medium)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h3 style={{
                  margin: 0,
                  color: '#222',
                  fontSize: '1.25rem',
                  fontWeight: 300,
                }}>
                  latest posts
                </h3>
              </div>
            </div>

            {/* Content */}
            <div style={{ 
              padding: '2rem',
            }}>
              {isLoadingPosts ? (
                <div style={{
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem'
                }}>
                  loading posts...
                </div>
              ) : patreonPosts.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem'
                }}>
                  {patreonPosts.map((post, index) => (
                    <div key={index} style={{
                      padding: '1rem',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <h4 style={{
                        margin: '0 0 0.5rem 0',
                        color: 'var(--color-text-primary)',
                        fontSize: '1.1rem',
                        fontWeight: '500'
                      }}>
                        {post.title}
                      </h4>
                      <div 
                        style={{
                          margin: '0 0 1rem 0',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.9rem',
                          lineHeight: 1.5
                        }}
                        dangerouslySetInnerHTML={{ __html: post.excerpt }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.8rem'
                        }}>
                          {post.date}
                        </span>
                        <a 
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--color-interactive-primary)',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          read more →
                        </a>
                      </div>
                    </div>
                  ))}
                  
                  <div style={{
                    textAlign: 'center',
                    marginTop: '1rem'
                  }}>
                    <a 
                      href="https://www.patreon.com/c/oppatchstudio/posts"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-primary)',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '1rem',
                        border: '1px solid var(--color-border-light)',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                      }}
                    >
                      <i className="fab fa-patreon" style={{ fontSize: '1rem' }}></i>
                      continue on patreon
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem'
                }}>
                  no posts available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {state.currentTab === 'library' && (
        <div
          role="tabpanel"
          id="library-tabpanel"
          aria-labelledby="library-tab"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '15px',
            border: '1px solid var(--color-border-subtle)',
            borderTop: 'none',
            minHeight: '500px',
            overflow: 'hidden'
          }}
        >
          <LibraryPage />
        </div>
      )}
    </div>
  );
}