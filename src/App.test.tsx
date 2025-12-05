import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Define PricingOption enum locally for testing
enum PricingOption {
  PAID = 0,
  FREE = 1,
  VIEW_ONLY = 2
}

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock IntersectionObserver
// @ts-ignore - global is available in test environment
global.IntersectionObserver = vi.fn().mockImplementation(() => {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Sample mock data
const mockGarmentData = [
  {
    id: 'content-001',
    creator: 'Adam',
    title: 'Yellow green coat',
    pricingOption: PricingOption.PAID,
    imagePath: 'https://example.com/image1.jpeg',
    price: 50
  },
  {
    id: 'content-002',
    creator: 'Benny',
    title: 'Brown Anorak',
    pricingOption: PricingOption.FREE,
    imagePath: 'https://example.com/image2.png',
    price: 30
  },
  {
    id: 'content-003',
    creator: 'Catlin',
    title: 'Block shape mini bag',
    pricingOption: PricingOption.VIEW_ONLY,
    imagePath: 'https://example.com/image3.jpeg',
    price: 15
  },
  {
    id: 'content-004',
    creator: 'Dan',
    title: 'Tartan mini dress',
    pricingOption: PricingOption.PAID,
    imagePath: 'https://example.com/image4.png',
    price: 300
  },
  {
    id: 'content-005',
    creator: 'Emily',
    title: 'Pink training suit',
    pricingOption: PricingOption.FREE,
    imagePath: 'https://example.com/image5.png',
    price: 200.5
  }
]

describe('App Component', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockGarmentData,
    });
    
    // Reset URL
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Fetching', () => {
    it('should fetch and display garment data on mount', async () => {
      render(<App />);

      // Check loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Verify API was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://closet-recruiting-api.azurewebsites.net/api/data'
      );

      // Verify items are displayed
      expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      expect(screen.getByText('Adam')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument();
      });
    });

    it('should display error when API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Failed to fetch data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter items by title', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'coat');

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.queryByText('Brown Anorak')).not.toBeInTheDocument();
      });
    });

    it('should filter items by creator name', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Adam')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'Adam');

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.queryByText('Brown Anorak')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'ADAM');

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });
    });

    it('should show no results message when search matches nothing', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No items found matching your criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('should filter by paid items', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const paidCheckbox = screen.getByLabelText('Paid');
      await userEvent.click(paidCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.getByText('Tartan mini dress')).toBeInTheDocument();
        expect(screen.queryByText('Brown Anorak')).not.toBeInTheDocument();
      });
    });

    it('should filter by free items', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Brown Anorak')).toBeInTheDocument();
      });

      const freeCheckbox = screen.getByLabelText('Free');
      await userEvent.click(freeCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Brown Anorak')).toBeInTheDocument();
        expect(screen.getByText('Pink training suit')).toBeInTheDocument();
        expect(screen.queryByText('Yellow green coat')).not.toBeInTheDocument();
      });
    });

    it('should filter by view only items', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Block shape mini bag')).toBeInTheDocument();
      });

      const viewOnlyCheckbox = screen.getByLabelText('View Only');
      await userEvent.click(viewOnlyCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Block shape mini bag')).toBeInTheDocument();
        expect(screen.queryByText('Yellow green coat')).not.toBeInTheDocument();
      });
    });

    it('should allow multiple filters', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const paidCheckbox = screen.getByLabelText('Paid');
      const freeCheckbox = screen.getByLabelText('Free');
      
      await userEvent.click(paidCheckbox);
      await userEvent.click(freeCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.getByText('Brown Anorak')).toBeInTheDocument();
        expect(screen.queryByText('Block shape mini bag')).not.toBeInTheDocument();
      });
    });

    it('should reset all filters', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const paidCheckbox = screen.getByLabelText('Paid');
      const resetButton = screen.getByText('RESET');
      
      await userEvent.click(paidCheckbox);
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(paidCheckbox).not.toBeChecked();
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.getByText('Brown Anorak')).toBeInTheDocument();
      });
    });
  });

  describe('Price Display', () => {
    it('should display paid items with formatted price', async () => {
      render(<App />);

      await waitFor(() => {
        const item = screen.getByText('Yellow green coat').closest('.content-item');
        expect(within(item!).getByText('$50.00')).toBeInTheDocument();
      });
    });

    it('should display FREE for free items', async () => {
      render(<App />);

      await waitFor(() => {
        const item = screen.getByText('Brown Anorak').closest('.content-item');
        expect(within(item!).getByText('FREE')).toBeInTheDocument();
      });
    });

    it('should display View Only for view only items', async () => {
      render(<App />);

      await waitFor(() => {
        const item = screen.getByText('Block shape mini bag').closest('.content-item');
        expect(within(item!).getByText('View Only')).toBeInTheDocument();
      });
    });

    it('should format prices with 2 decimal places', async () => {
      render(<App />);

      await waitFor(() => {
        const item = screen.getByText('Pink training suit').closest('.content-item');
        expect(within(item!).getByText('FREE')).toBeInTheDocument();
      });
    });
  });

  describe('URL Parameter Persistence', () => {
    it('should restore search query from URL', async () => {
      window.history.replaceState({}, '', '/?search=coat');
      
      render(<App />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i) as HTMLInputElement;
        expect(searchInput.value).toBe('coat');
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });
    });

    it('should restore filters from URL', async () => {
      window.history.replaceState({}, '', '/?paid=true&free=true');
      
      render(<App />);

      await waitFor(() => {
        const paidCheckbox = screen.getByLabelText('Paid') as HTMLInputElement;
        const freeCheckbox = screen.getByLabelText('Free') as HTMLInputElement;
        expect(paidCheckbox.checked).toBe(true);
        expect(freeCheckbox.checked).toBe(true);
      });
    });

    it('should update URL when search changes', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'test');

      // Wait for debounce
      await waitFor(() => {
        expect(window.location.search).toContain('search=test');
      }, { timeout: 500 });
    });

    it('should update URL when filters change', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      const paidCheckbox = screen.getByLabelText('Paid');
      await userEvent.click(paidCheckbox);

      await waitFor(() => {
        expect(window.location.search).toContain('paid=true');
      });
    });
  });

  describe('Infinite Scrolling', () => {
    it('should initially display first chunk of items', async () => {
      // Create more items to test chunking
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        id: `content-${String(i + 1).padStart(3, '0')}`,
        creator: `Creator${i}`,
        title: `Item ${i + 1}`,
        pricingOption: PricingOption.PAID,
        imagePath: `https://example.com/image${i}.png`,
        price: 10 + i
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => manyItems,
      });

      render(<App />);

      await waitFor(() => {
        // Should show first 12 items (CHUNK_SIZE = 12)
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 12')).toBeInTheDocument();
        // Item 13 should not be visible yet
        expect(screen.queryByText('Item 13')).not.toBeInTheDocument();
      });
    });
  });

  describe('Combined Filters and Search', () => {
    it('should combine search and filters correctly', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
      });

      // Apply search
      const searchInput = screen.getByPlaceholderText(/Find the items you're looking for/i);
      await userEvent.type(searchInput, 'coat');

      // Apply paid filter
      const paidCheckbox = screen.getByLabelText('Paid');
      await userEvent.click(paidCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Yellow green coat')).toBeInTheDocument();
        expect(screen.queryByText('Brown Anorak')).not.toBeInTheDocument();
      });
    });
  });
});

