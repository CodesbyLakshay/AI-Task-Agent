const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
const HF_API_TOKEN = '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'; // Your token here

function activate(context) {
    console.log('AI Task Agent is now active!');

    let disposable = vscode.commands.registerCommand('ai-task-agent.start', async () => {
        const panel = vscode.window.createWebviewPanel(
            'aiChat',
            'AI Task Agent',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from Webview:', message);
            if (message.type === 'task') {
                const task = message.task;
                console.log('Processing task:', task);
                try {
                    console.log('Making API call to Hugging Face...');
                    const response = await axios.post(
                        HF_API_URL,
                        { inputs: `Generate a list of commands to ${task}` },
                        { headers: { Authorization: `Bearer ${HF_API_TOKEN}` } }
                    );
                    console.log('API Response:', response.data);
                    const plan = response.data[0].generated_text;
                    console.log('Sending plan to Webview:', plan);
                    panel.webview.postMessage({ type: 'plan', plan });
                } catch (error) {
                    console.error('API Error:', error.message, error.response ? error.response.data : null);
                    try {
                        vscode.window.showErrorMessage(`AI API error: ${error.message}`);
                    } catch (notificationError) {
                        console.error('Failed to show error message:', notificationError);
                    }
                }
            } else if (message.type === 'approve') {
                // ... (rest of the code unchanged)
            } else if (message.type === 'feedback') {
                // ... (rest of the code unchanged)
            }
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html>
        <body>
            <h2>AI Task Agent</h2>
            <input id="task" placeholder="Enter task (e.g., Generate a Python script to print Hello)" style="width: 300px;" autofocus />
            <button id="submitBtn">Submit</button>
            <pre id="plan"></pre>
            <button id="approveBtn" style="display:none">Approve</button>
            <pre id="output"></pre>
            <div id="feedback" style="display:none">
                <p>Was the task successful?</p>
                <button id="yesBtn">Yes</button>
                <button id="noBtn">No</button>
                <textarea id="reason" placeholder="Reason for failure" style="display:none"></textarea>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                let currentTask = '';

                window.sendTask = function() {
                    const taskInput = document.getElementById('task');
                    const task = taskInput.value.trim();
                    if (!task) {
                        console.log('No task entered');
                        return;
                    }
                    currentTask = task;
                    console.log('Sending task:', task);
                    vscode.postMessage({ type: 'task', task });
                };

                window.approve = function() {
                    const plan = document.getElementById('plan').innerText;
                    console.log('Approving plan:', plan);
                    vscode.postMessage({ type: 'approve', commands: plan });
                };

                window.sendFeedback = function(success) {
                    const reasonTextarea = document.getElementById('reason');
                    if (success) {
                        console.log('Feedback: Success');
                        vscode.postMessage({ type: 'feedback', success: true });
                    } else {
                        reasonTextarea.style.display = 'block';
                        const reason = reasonTextarea.value.trim();
                        console.log('Feedback: Failure, Reason:', reason);
                        vscode.postMessage({ type: 'feedback', success: false, reason, task: currentTask });
                    }
                };

                document.getElementById('submitBtn').addEventListener('click', window.sendTask);
                document.getElementById('task').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        console.log('Enter pressed, submitting task');
                        window.sendTask();
                    }
                });
                document.getElementById('approveBtn').addEventListener('click', window.approve);
                document.getElementById('approveBtn').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') window.approve();
                });
                document.getElementById('yesBtn').addEventListener('click', () => window.sendFeedback(true));
                document.getElementById('yesBtn').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') window.sendFeedback(true);
                });
                document.getElementById('noBtn').addEventListener('click', () => window.sendFeedback(false));
                document.getElementById('noBtn').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') window.sendFeedback(false);
                });

                window.addEventListener('message', (event) => {
                    const msg = event.data;
                    console.log('Received message:', msg);
                    if (msg.type === 'plan') {
                        document.getElementById('plan').innerText = msg.plan;
                        document.getElementById('approveBtn').style.display = 'block';
                        document.getElementById('approveBtn').focus();
                    } else if (msg.type === 'output') {
                        document.getElementById('output').innerText = msg.stdout + (msg.stderr ? '\\nError: ' + msg.stderr : '');
                        document.getElementById('feedback').style.display = 'block';
                        document.getElementById('yesBtn').focus();
                    } else if (msg.type === 'feedback') {
                        document.getElementById('feedback').style.display = 'block';
                        document.getElementById('reason').style.display = 'none';
                    }
                });

                document.getElementById('task').focus();
            </script>
        </body>
        </html>
    `;
}

module.exports = {
    activate,
    deactivate
};