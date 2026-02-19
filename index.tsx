/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CATEGORIES } from './categories';

interface ClassificationResult {
  category: string;
  confidence: number;
  pivot: string;
}

// --- PIVOT CUBE VISUALIZATION ---

// A map for precise pivot point locations based on their codes (e.g., C4, E3).
const pivotCodeMap: Record<string, { face: string; x: string; y: string }> = {
  'C1': { face: 'bottom', x: '0%', y: '100%' },   // Front-Left
  'C2': { face: 'bottom', x: '100%', y: '100%' }, // Front-Right
  'C3': { face: 'bottom', x: '100%', y: '0%' },    // Back-Right
  'C4': { face: 'bottom', x: '0%', y: '0%' },     // Back-Left
  'C7': { face: 'top', x: '100%', y: '0%' },    // Top-Back-Right
  'C8': { face: 'top', x: '0%', y: '0%' },     // Top-Back-Left
  'E1': { face: 'bottom', x: '50%', y: '100%' }, // Bottom-Front-Edge
  'E3': { face: 'bottom', x: '50%', y: '0%' },   // Bottom-Back-Edge
  'E11': { face: 'top', x: '50%', y: '0%' },   // Top-Back-Edge
  'S1': { face: 'bottom', x: '50%', y: '50%' }, // Bottom-Surface
  'S4': { face: 'back', x: '50%', y: '50%' },   // Back-Surface
  'S6': { face: 'top', x: '50%', y: '50%' },     // Top-Surface
};

/**
 * Parses a pivot string to determine the face and coordinates for the 3D cube marker.
 * It first tries to use the precise code (e.g., C4) and falls back to keyword analysis.
 */
const parsePivotPosition = (pivot: string): { face: string; x: string; y: string } | null => {
  if (!pivot) return null;

  const codeMatch = pivot.match(/\((C|E|S|A)\d*\)/);
  if (codeMatch) {
    const code = codeMatch[0].replace(/[()]/g, '');
    if (pivotCodeMap[code]) {
      return pivotCodeMap[code];
    }
  }

  const lowerPivot = pivot.toLowerCase();
  let face = 'bottom';
  if (lowerPivot.includes('back')) face = 'back';
  else if (lowerPivot.includes('front')) face = 'front';
  else if (lowerPivot.includes('left')) face = 'left';
  else if (lowerPivot.includes('right')) face = 'right';
  else if (lowerPivot.includes('top')) face = 'top';

  let x = '50%';
  if (lowerPivot.includes('left')) x = '0%';
  else if (lowerPivot.includes('right')) x = '100%';

  let y = '50%';
  if (face === 'top' || face === 'bottom') {
    if (lowerPivot.includes('back')) y = '0%';
    else if (lowerPivot.includes('front')) y = '100%';
  } else {
    if (lowerPivot.includes('top')) y = '0%';
    else if (lowerPivot.includes('bottom')) y = '100%';
  }

  if (lowerPivot.includes('center') || lowerPivot.includes('middle')) {
    x = '50%';
    y = '50%';
  }

  return { face, x, y };
};

/**
 * A React component that renders a 3D cube to visualize the pivot point.
 */
const PivotCube = ({ pivot }: { pivot: string }) => {
  const position = parsePivotPosition(pivot);
  const faces = [
    { name: 'front', label: 'Front' },
    { name: 'back', label: 'Back' },
    { name: 'top', label: 'Top' },
    { name: 'bottom', label: 'Bottom' },
    { name: 'left', label: 'Left' },
    { name: 'right', label: 'Right' }
  ];

  return (
    <div className="flex flex-col items-center mt-6">
      <div className="cube-container">
        <div className="cube">
          {faces.map(({ name, label }) => (
            <div key={name} className={`cube-face ${name}`}>
              {label}
              {position && position.face === name && (
                <div
                  className="pivot-point"
                  style={{ left: position.x, top: position.y }}
                  aria-label={`Pivot point at ${position.x}, ${position.y} on the ${name} face`}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 p-4 bg-gray-100 rounded-lg text-center w-full shadow-inner">
        <p className="text-sm text-gray-600 font-semibold">Pivot Point:</p>
        <p className="text-base text-gray-800 font-mono break-words">{pivot}</p>
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copiedCategory, setCopiedCategory] = useState<string | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);

  async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setResults([]);
      setError(null);
      setNotFound(false);
      setSelectedResultIndex(null);
    } else {
      setError('Please provide an image file.');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleCopy = (category: string) => {
    navigator.clipboard.writeText(category);
    setCopiedCategory(category);
    setTimeout(() => setCopiedCategory(null), 2000);
  };

  const handleClassify = async () => {
    if (!imageFile) {
      setError('Please select an image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setNotFound(false);
    setSelectedResultIndex(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imagePart = await fileToGenerativePart(imageFile);
      const pivotMap = new Map(CATEGORIES.map(item => [item.category, item.pivot]));

      const prompt = `Analyze the image and identify the object(s) shown. From the following list of categories, please select all that apply. For each category, provide a confidence score between 0 and 1 indicating how certain you are of the match. Order the results from most to least relevant. If none of the categories apply, return an empty array.

Categories:
${CATEGORIES.map(c => c.category).join('\n')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            imagePart,
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ['category', 'confidence']
                }
              }
            }
          },
        },
      });

      const classified = JSON.parse(response.text);

      if (classified.categories && classified.categories.length > 0) {
        const categoriesWithPivots = classified.categories.map((result: { category: string; confidence: number; }) => ({
          ...result,
          pivot: pivotMap.get(result.category) || 'Pivot information not available.',
        }));
        setResults(categoriesWithPivots);
        setSelectedResultIndex(0);
      } else {
        setNotFound(true);
      }

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const ResultDisplay = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-gray-500 mt-8 h-full">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-lg">Analyzing...</p>
        </div>
      );
    }

    if (error) {
      return <p className="mt-8 text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
    }

    if (notFound) {
      return <p className="mt-8 text-center text-2xl font-semibold text-gray-700">не нашел</p>;
    }

    if (results.length > 0) {
      return (
        <div className="w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Found Categories:</h2>
          <ul className="border border-gray-200 rounded-lg space-y-2 p-2 max-h-[50vh] overflow-y-auto">
            {results.map((result, index) => (
              <li
                key={index}
                onClick={() => setSelectedResultIndex(index)}
                className={`flex items-center justify-between text-gray-800 p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-blue-50 ${selectedResultIndex === index ? 'bg-blue-100 border-l-4 border-blue-500' : 'bg-white'}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedResultIndex(index)}
              >
                <span className="font-mono font-medium text-sm md:text-base">{result.category}</span>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-200/50 px-2.5 py-1 rounded-full">
                    {Math.round(result.confidence * 100)}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(result.category);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={`Copy category ${result.category}`}
                  >
                    {copiedCategory === result.category ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Nfinite category classifier</h1>
          <p className="text-gray-500">Upload an image to classify it into a category.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Uploader */}
          <div className="w-full">
            <label
              htmlFor="file-upload"
              className="w-full cursor-pointer"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              aria-label="Image upload drop zone"
            >
              <div className={`flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-900/25 hover:border-gray-400'}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
                ) : (
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                    </svg>
                    <div className="mt-4 flex text-sm leading-6 text-gray-600">
                      <p className="pl-1">Click to upload or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-gray-600">PNG, JPG, etc.</p>
                  </div>
                )}
              </div>
            </label>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />

            <button
              onClick={handleClassify}
              disabled={!imageFile || isLoading}
              className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Classify uploaded image"
            >
              {isLoading ? 'Analyzing...' : 'Classify Image'}
            </button>
          </div>

          {/* Right Column: Results and Cube */}
          <div className="flex flex-col space-y-6">
            <div className="flex-grow min-h-[100px]">
              <ResultDisplay />
            </div>
            {selectedResultIndex !== null && results.length > 0 && results[selectedResultIndex] && (
              <div className="mt-4">
                <PivotCube pivot={results[selectedResultIndex].pivot} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);