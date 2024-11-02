import natural from 'natural';
import { removeStopwords} from 'stopword'

// Initialize the natural language processing tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const lemmatizer = new natural.WordNet();

// Tokenize and clean text
export function tokenizeText(text: string): string[] {
  const tokens = tokenizer.tokenize(text.toLowerCase());
  if (!tokens) return [];
  
  // Remove stopwords
  return removeStopwords(tokens);
}

export function stemWords(words: string[]): string[] {
  return words.map(word => stemmer.stem(word));
}

// lookup similar variations of words
export async function lemmatizeWords(words: string[]): Promise<string[]> {
  const lemmatizedWords: string[] = [];
  
  for (const word of words) {
    try {
      await new Promise((resolve) => {
        lemmatizer.lookup(word, (results: any) => {
          if (results.length > 0) {
            lemmatizedWords.push(results[0].lemma);
          } else {
            lemmatizedWords.push(word);
          }
          resolve(null);
        });
      });
    } catch (error) {
      lemmatizedWords.push(word);
    }
  }
  
  return lemmatizedWords;
}

// Get semantic similarity between two words
export function getWordSimilarity(word1: string, word2: string): number {
  return natural.JaroWinklerDistance(word1, word2, { ignoreCase: true });
}

// Find matches between query and keywords
export async function findKeywordMatches(
  queryWords: string[], 
  keywords: string[]
): Promise<Set<string>> {
  const matches = new Set<string>();

  const stemmedQuery = stemWords(queryWords);
  const lemmatizedQuery = await lemmatizeWords(queryWords);
  
  const endpointKeywords = await Promise.all(
    keywords.map(async (keyword) => {
      const tokens = tokenizeText(keyword);
      return {
        original: keyword,
        stemmed: stemWords(tokens),
        lemmatized: await lemmatizeWords(tokens)
      };
    })
  );
  
  // Find matches b/w user query word & FMP data endpoint key words
  for (let i = 0; i < queryWords.length; i++) {
    for (const keyword of endpointKeywords) {
      // Direct match
      if (queryWords[i] === keyword.original) {
        matches.add(keyword.original);
        continue;
      }
      
      // Stem match
      if (stemmedQuery[i] && keyword.stemmed.some(stem => stem === stemmedQuery[i])) {
        matches.add(keyword.original);
        continue;
      }
      
      // Lemma match
      if (lemmatizedQuery[i] && keyword.lemmatized.some(lemma => lemma === lemmatizedQuery[i])) {
        matches.add(keyword.original);
        continue;
      }
      
      // Similarity match (for typos and variations)
      if (keyword.original.split(' ').some(word => 
        getWordSimilarity(queryWords[i], word) > 0.9
      )) {
        matches.add(keyword.original);
      }
    }
  }
  
  return matches;
}