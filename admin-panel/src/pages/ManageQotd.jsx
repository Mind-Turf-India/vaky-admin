import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ManageQotd = () => {
  const [quotes, setQuotes] = useState([]);
  const [newQuote, setNewQuote] = useState({ imageURL: "", title: "" });
  const [editQuote, setEditQuote] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Function to format date as DD-MM-YYYY
  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  // Fetch QOTD Quotes (Sorted by Date)
  const fetchQuotes = async () => {
    let q = query(collection(db, "qotd"), orderBy("id"));

    // Apply date filter if selected
    if (startDate && endDate) {
      q = query(
        collection(db, "qotd"),
        where("id", ">=", formatDate(startDate)),
        where("id", "<=", formatDate(endDate))
      );
    }

    const snapshot = await getDocs(q);
    const quoteList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setQuotes(quoteList);
  };

  useEffect(() => {
    fetchQuotes();
  }, [startDate, endDate]);

  // Add or Edit Quote
  const handleSave = async () => {
    const docId = editQuote ? editQuote.id : formatDate(new Date());
    await setDoc(doc(db, "qotd", docId), {
      imageURL: newQuote.imageURL,
      title: newQuote.title
    });

    setNewQuote({ imageURL: "", title: "" });
    setEditQuote(null);
    fetchQuotes();
  };

  // Delete Quote
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "qotd", id));
    fetchQuotes();
  };

  return (
    <div>
      <h2>QOTD Manager</h2>

      {/* Date Range Filter */}
      <div>
        <label>Filter by Date: </label>
        <DatePicker
          selected={startDate}
          onChange={setStartDate}
          dateFormat="dd-MM-yyyy"
          placeholderText="Start Date"
        />
        <DatePicker
          selected={endDate}
          onChange={setEndDate}
          dateFormat="dd-MM-yyyy"
          placeholderText="End Date"
        />
        <button onClick={fetchQuotes}>Filter</button>
      </div>

      {/* Add/Edit Quote */}
      <div>
        <input type="text" placeholder="Image URL" value={newQuote.imageURL} onChange={(e) => setNewQuote({ ...newQuote, imageURL: e.target.value })} />
        <input type="text" placeholder="Title" value={newQuote.title} onChange={(e) => setNewQuote({ ...newQuote, title: e.target.value })} />
        <button onClick={handleSave}>{editQuote ? "Update Quote" : "Add Quote"}</button>
      </div>

      {/* Display Quotes */}
      <table border="1">
        <thead>
          <tr>
            <th>Date</th>
            <th>Image</th>
            <th>Title</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr key={quote.id}>
              <td>{quote.id}</td>
              <td><img src={quote.imageURL} alt="Quote" width="50" /></td>
              <td>{quote.title}</td>
              <td>
                <button onClick={() => setEditQuote(quote)}>Edit</button>
                <button onClick={() => handleDelete(quote.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManageQotd;

