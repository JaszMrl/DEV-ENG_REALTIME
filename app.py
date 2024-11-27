from flask import Flask, render_template

# Initialize Flask app
app = Flask(__name__)

# Home Page
@app.route('/')
def home():
    return render_template('index.html')

# Easy Mode Page
@app.route('/easy')
def easy():
    return render_template('easy-mode.html')

# Medium Mode Page
@app.route('/medium')
def medium():
    return render_template('medium-mode.html')

# Hard Mode Page
@app.route('/hard')
def hard():
    return render_template('hard-mode.html')

if __name__ == '__main__':
    app.run(debug=True)
