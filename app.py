import os
import streamlit as st
from dotenv import load_dotenv
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.vectorstores import InMemoryVectorStore
from time import sleep

# Load the environment variables (e.g., GOOGLE_API_KEY) [5]
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

# Initialize Streamlit Session State variables [10-13]
if 'web_loaded' not in st.session_state:
    st.session_state.web_loaded = False
if 'vector_db' not in st.session_state:
    st.session_state.vector_db = None
if 'messages' not in st.session_state:
    st.session_state.messages = []

def process_urls(urls):
    try:
        all_docs = []
        for url in urls:
            if not url.lower().startswith(("http://", "https://")):
                url = "https://" + url

            # Load web page data [14-16]
            loader = WebBaseLoader(web_paths=[url])
            docs = loader.load()
            # Ensure data is extended, not appended, to avoid nested lists [17]
            all_docs.extend(docs)

        if not all_docs:
            st.error("No content was loaded from the provided URLs.")
            return

        # Split the loaded data into small chunks [6]
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = splitter.split_documents(all_docs)

        # Generate Embeddings and store them in an In-Memory Vector Store [7]
        embeddings = GoogleGenerativeAIEmbeddings(model="gemini-embedding-2-preview")
        vector_db = InMemoryVectorStore.from_documents(documents=docs, embedding=embeddings)

        # Store Vector DB in session state and update web_loaded flag [11]
        st.session_state.vector_db = vector_db
        st.session_state.web_loaded = True
        
        st.success("URLs Processed Successfully") # [18]
        sleep(2) # [18]
        st.rerun() # [18]
    except Exception as e:
        st.error(f"Error processing URLs: {e}")
        return

if not api_key:
    st.error("GOOGLE_API_KEY or GEMINI_API_KEY is required. Set it in your .env file or environment.")
    st.stop()

# Build the UI
st.subheader("Customer Support QnA Bot") # [9]

# Show URL input if websites are not loaded yet [19]
if not st.session_state.web_loaded:
    urls = st.text_area("Enter URLs One per line") # [19]
    if urls:
        url_list = [u.strip() for u in urls.splitlines() if u.strip()]
        if url_list:
            with st.spinner("Processing..."): # [20]
                process_urls(url_list)
        else:
            st.error("Please enter one or more valid URLs, one per line.")

# Show Chat Interface if data is successfully processed into the Vector DB [21]
if st.session_state.web_loaded and st.session_state.vector_db:
    
    # Display previous chat messages from history [13]
    for message in st.session_state.messages:
        role = message["role"]
        content = message["content"]
        st.chat_message(role).markdown(content)

    # Accept user query [22]
    query = st.chat_input()
    
    if query:
        # Show and save user message [13, 23]
        st.chat_message("user").markdown(query)
        st.session_state.messages.append({"role": "user", "content": query})

        # Perform Similarity Search to fetch Top 6 related chunks [24, 25]
        records = st.session_state.vector_db.similarity_search(query=query, k=6)
        
        # Build the context string [26]
        context = ""
        for chunk in records:
            context += chunk.page_content + "\n\n"

        # Initialize the LLM with a lightweight Gemini model [8, 9]
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=api_key)
        
        # Create Prompt with Context and Query [27]
        prompt = f"Give me final answer for my question based on the provided context.\nContext: {context}\nQuestion is: {query}"
        
        # Get AI Response [27]
        response = llm.invoke(prompt)
        
        # Show and save AI response [13, 23]
        st.chat_message("ai").markdown(response.content)
        st.session_state.messages.append({"role": "ai", "content": response.content})