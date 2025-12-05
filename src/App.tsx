import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
enum PricingOption {
  PAID = 0,
  FREE = 1,
  VIEW_ONLY = 2
}

interface GarmentDetailData {
  id: string; 
  creator: string;        
  title: string;
  pricingOption: PricingOption;
  imagePath: string;
  price: number;
}

const CHUNK_SIZE = 12;

function App() {
  const [items, setItems] = useState<GarmentDetailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pricingFilters, setPricingFilters] = useState({
    paid: false,
    free: false,
    viewOnly: false
  });
  const [displayedChunks, setDisplayedChunks] = useState(1);
  const observerTarget = useRef<HTMLDivElement>(null);
  const isInitializing = useRef(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlRef = useRef<string>('');

  // Helper function to build URL from state
  const buildUrl = useCallback((search: string, filters: typeof pricingFilters) => {
    const params = new URLSearchParams();
    
    if (search.trim()) {
      params.set('search', search.trim());
    }
    
    if (filters.paid) params.set('paid', 'true');
    if (filters.free) params.set('free', 'true');
    if (filters.viewOnly) params.set('viewOnly', 'true');
    
    return params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
  }, []);

  // Initialize state from URL parameters (only on mount)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const urlSearch = params.get('search') || '';
    const urlFilters = {
      paid: params.get('paid') === 'true',
      free: params.get('free') === 'true',
      viewOnly: params.get('viewOnly') === 'true'
    };
    
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
    
    setPricingFilters(urlFilters);
    
    // Store initial URL
    lastUrlRef.current = buildUrl(urlSearch, urlFilters);
    isInitializing.current = false;
  }, [buildUrl]);

  // Update URL when filters change (debounced for search)
  useEffect(() => {
    // Skip URL update during initialization
    if (isInitializing.current) return;

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search query updates (300ms delay)
    const updateUrl = () => {
      const newUrl = buildUrl(searchQuery, pricingFilters);
      
      // Only update if URL actually changed
      if (newUrl !== lastUrlRef.current) {
        window.history.replaceState({}, '', newUrl);
        lastUrlRef.current = newUrl;
      }
    };

    // For search, debounce; for filters, update immediately
    const isSearchChange = searchQuery !== (new URLSearchParams(window.location.search).get('search') || '');
    
    if (isSearchChange) {
      searchTimeoutRef.current = setTimeout(updateUrl, 300);
    } else {
      updateUrl();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, pricingFilters, buildUrl]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://closet-recruiting-api.azurewebsites.net/api/data');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        if (isMounted) {
          const garmentDetailData: GarmentDetailData[] = await response.json();
          setItems(garmentDetailData);
          setError(null);
        } 
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
        console.error('Error fetching data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    // cleanup: component unmounts  
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterChange = (filter: keyof typeof pricingFilters) => {
    setPricingFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const handleReset = () => {
    setPricingFilters({
      paid: false,
      free: false,
      viewOnly: false
    });
    setSearchQuery('');
  };

  const getFilteredItems = () => {
    let filtered = items;

    // Apply pricing filters
    const activeFilters = Object.entries(pricingFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => key);

    if (activeFilters.length > 0) {
      filtered = filtered.filter(item => {
        if (pricingFilters.paid && item.pricingOption === PricingOption.PAID) {
          return true;
        }
        if (pricingFilters.free && item.pricingOption === PricingOption.FREE) {
          return true;
        }
        if (pricingFilters.viewOnly && item.pricingOption === PricingOption.VIEW_ONLY) {
          return true;
        }
        return false;
      });
    }

    // Apply keyword search - filters by creator name (user name) or title
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.creator.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const filteredItems = getFilteredItems();
  const displayedItems = filteredItems.slice(0, displayedChunks * CHUNK_SIZE);
  const hasMore = displayedItems.length < filteredItems.length;

  // Reset displayed chunks when filters or search change
  useEffect(() => {
    setDisplayedChunks(1);
  }, [searchQuery, pricingFilters.paid, pricingFilters.free, pricingFilters.viewOnly]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setDisplayedChunks((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading]);

  const getPriceDisplay = (item: GarmentDetailData): string | 'FREE' | 'View Only' => {
    if (item.pricingOption === PricingOption.PAID) {
      return `$${item.price.toFixed(2)}`;
    } else if (item.pricingOption === PricingOption.FREE) {
      return 'FREE';
    } else {
      // pricingOption === PricingOption.VIEW_ONLY
      return 'View Only';
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo" title='CONNECT'>
          <a href="/">
            <span aria-label="Go to Connect Main Page" className='logo-text'></span>
          </a>
        </div>
        <button className="required-feature-btn">REQUIRED FEATURE</button>
      </header>
      <main>
        <div className="main-container">
          {/* Search Bar */}
          <div className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="Find the items you're looking for"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>

          {/* Filters and Keyword Search */}
          <div className="filters-section">
            <div className="filter-group">
              <div className="pricing-options">
                <div className="pricing-label">Pricing Option</div>
                <div className="checkboxes">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={pricingFilters.paid}
                      onChange={() => handleFilterChange('paid')}
                    />
                    <span>Paid</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={pricingFilters.free}
                      onChange={() => handleFilterChange('free')}
                    />
                    <span>Free</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={pricingFilters.viewOnly}
                      onChange={() => handleFilterChange('viewOnly')}
                    />
                    <span>View Only</span>
                  </label>
                </div>
                <button className="reset-btn" onClick={handleReset}>RESET</button>
              </div>
            </div>
          </div>

          {/* Contents List */}
          <div className="contents-section">
            {loading && <div className="loading-message">Loading...</div>}
            {error && <div className="error-message">Error: {error}</div>}
            {!loading && !error && (
              <>
                <div className="contents-grid">
                  {displayedItems.length === 0 ? (
                    <div className="no-results">No items found matching your criteria.</div>
                  ) : (
                    displayedItems.map(item => {
                      const priceDisplay = getPriceDisplay(item);
                      return (
                        <div key={item.id} className="content-item">
                          <div className="item-image">
                            <img src={item.imagePath} alt={item.title} />
                          </div>
                          <div className="item-info">
                            <div className="item-left">
                              <div className="item-name">{item.title}</div>
                              <div className="item-creator">{item.creator}</div>
                            </div>
                            <div className={`item-price ${priceDisplay === 'FREE' ? 'free' : priceDisplay === 'View Only' ? 'view-only' : 'paid'}`}>
                              {priceDisplay}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {hasMore && (
                  <div ref={observerTarget} className="loading-message">
                    Loading more items...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}

export default App;
