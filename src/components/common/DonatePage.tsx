import { useState, useEffect } from 'react';
import { scrapePatreonPosts, type PatreonPost } from '../../utils/patreonPosts';

export function DonatePage() {
  const [patreonPosts, setPatreonPosts] = useState<PatreonPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load Patreon posts when component mounts
  useEffect(() => {
    if (patreonPosts.length === 0 && !isLoadingPosts && !hasError) {
      setIsLoadingPosts(true);
      setHasError(false);
      scrapePatreonPosts()
        .then(posts => {
          setPatreonPosts(posts);
          setIsLoadingPosts(false);
        })
        .catch(error => {
          console.error('Failed to load Patreon posts:', error);
          setIsLoadingPosts(false);
          setHasError(true);
        });
    }
  }, [patreonPosts.length, isLoadingPosts, hasError]);

  return (
    <>
      {/* Donate Section */}
      <div style={{
        background: 'var(--color-bg-primary)',
        borderRadius: '15px',
        boxShadow: '0 2px 8px var(--color-shadow-primary)',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        marginBottom: '1rem',
        margin: isMobile ? '0.5rem' : '2rem'
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
          padding: isMobile ? '1rem' : '2rem',
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
              OP-PatchStudio is a 100% free and <a href="https://github.com/joseph-holland/op-patchstudio" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-interactive-primary)', textDecoration: 'underline' }}>open-source</a> tool for creating and editing drum and multisample presets for the OP-XY (more devices coming soon).<br/><br/>
              most features have come from community ideas and requests. by joining the <a href="https://www.patreon.com/c/oppatchstudio" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-interactive-primary)', textDecoration: 'underline' }}>project patreon</a>, you'll get behind-the-scenes updates, voting rights on roadmap features, priority support, exclusive content, tutorials and early access to preview features.<br/><br/>
              your support helps cover the cost of ai coding tools and services that make rapid development of new features and support possible.
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
        margin: isMobile ? '0.5rem' : '2rem'
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
          padding: isMobile ? '1rem' : '2rem',
        }}>
          {isLoadingPosts ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '1rem'
            }}>
              loading posts...
            </div>
          ) : hasError ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '1rem'
            }}>
              failed to load posts
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
    </>
  );
} 