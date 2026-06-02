import os
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.vectorstores import InMemoryVectorStore


class RAGService:
    """
    Encapsulates the full RAG pipeline:
    URL scraping → text splitting → embedding → vector search → LLM response
    """

    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set."
            )
        self.vector_db = None
        self.loaded_urls: list[str] = []

    async def process_urls(self, urls: list[str]) -> dict:
        """
        Scrape each URL, split the content into chunks,
        generate embeddings and store them in memory.
        Returns the number of chunks created.
        """
        all_docs = []

        for url in urls:
            # Auto-prefix https:// if missing
            if not url.lower().startswith(("http://", "https://")):
                url = "https://" + url

            loader = WebBaseLoader(web_paths=[url])
            docs = loader.load()
            all_docs.extend(docs)
            self.loaded_urls.append(url)

        if not all_docs:
            raise ValueError(
                "No content could be loaded from the provided URLs. "
                "The page may block server-side access."
            )

        # Split into manageable chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = splitter.split_documents(all_docs)

        # Create embeddings and store in InMemoryVectorStore
        embeddings = GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-2-preview",
            google_api_key=self.api_key
        )
        self.vector_db = InMemoryVectorStore.from_documents(
            documents=chunks,
            embedding=embeddings
        )

        return {"chunks": len(chunks)}

    async def chat(self, query: str) -> tuple[str, list[str]]:
        """
        Retrieve the top-6 relevant chunks, build a prompt,
        and call Gemini 2.5 Flash to generate an answer.
        Returns (answer_text, list_of_source_urls).
        """
        if self.vector_db is None:
            raise ValueError("No data loaded. Please call process_urls() first.")

        # Retrieve most relevant chunks
        records = self.vector_db.similarity_search(query=query, k=6)

        # Extract unique source URLs
        sources = list(set(
            doc.metadata.get("source", "")
            for doc in records
            if doc.metadata.get("source")
        ))

        # Build context string
        context = "\n\n".join(doc.page_content for doc in records)

        # Initialize Gemini LLM
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=self.api_key
        )

        prompt = f"""You are a helpful and friendly AI assistant. Answer the user's question \
using ONLY the provided context from the website. Be concise, accurate, and conversational.
If the context doesn't contain enough information, say so honestly.

Context from website:
{context}

User Question: {query}

Answer:"""

        response = llm.invoke(prompt)
        return response.content, sources
