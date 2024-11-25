import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, ConfusionMatrixDisplay
import joblib
import matplotlib.pyplot as plt

# Load data from CSV file
data = pd.read_csv('MFCC_Data_frames.csv')

# Separate features (X) and labels (y)
X = data.drop(columns=['label'])  # Features with column names
y = data['label']  # Labels

# Debug: Check training feature names
print(f"Training feature names: {X.columns}")
print(f"Labels used for training: {y.unique()}")

# Split data into training and test sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Create Decision Tree model
clf = DecisionTreeClassifier()

# Train model with training data
clf.fit(X_train, y_train)

# Evaluate the model
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy * 100:.2f}%")
print("Classification Report:")
print(classification_report(y_test, y_pred))

# Save the trained model
joblib.dump(clf, 'decision_tree_model.joblib')
print("Model saved as 'decision_tree_model.joblib'")

# Debug: Check model feature names
print(f"Training feature names: {X.columns}")


# Create and display confusion matrix
cm = confusion_matrix(y_test, y_pred, labels=clf.classes_)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=clf.classes_)
disp.plot(cmap=plt.cm.Blues)
plt.title("Confusion Matrix")
plt.show()
