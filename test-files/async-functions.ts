// Test file 4: Async functions and error handling

async function fetchUserData(userId: number): Promise<UserData | null> {
    try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        return null;
    }
}

function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

class ApiClient {
    private baseUrl: string;
    private headers: Record<string, string>;

    constructor(baseUrl: string, apiKey?: string) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Content-Type': 'application/json',
            ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        };
    }

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.headers
        });

        if (!response.ok) {
            throw new Error(`GET request failed: ${response.statusText}`);
        }

        return response.json();
    }

    async post<T>(endpoint: string, data: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`POST request failed: ${response.statusText}`);
        }

        return response.json();
    }
}