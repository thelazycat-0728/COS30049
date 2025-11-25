**🌿 SmartPlant System**

SmartPlant is an AI-powered mobile application designed to help users identify plants, visualize geographical growing patterns, protect plantations using IoT monitoring, and ensure user data privacy through secure backend architecture. The system also includes automated AI retraining to support continuous learning and improvement.

**👥 Contributing Members**

| **Name** | **Role** |
| --- | --- |
| Jonathan Kuok Kai YEO |     |
| James Teck Hock WONG |     |
| Miccole Yee Syuen PHIONG |     |
| Jun Wen NG |     |
| Aaron Yi Heng LAU |     |
| Daryl Jia Jie TAN |     |
| Chow Xian CHUNG |     |

**🚀 Key Features**

- **AI-Powered Mobile Plant Identification**
- **Visualization & Mapping Tools**
- **IoT-Enabled Plant Protection Alerts**
- **Cybersecurity & Data Privacy Controls**
- **Automated AI Model Retraining Module**

**🛠️ Local Development Setup**

**1\. Clone the Repository**

git clone <https://github.com/thelazycat-0728/COS30049>

cd COS30049

**2\. Install Dependencies**

**Frontend**

cd frontend

npm install

**Backend**

cd ..

cd backend

npm install

**AI Backend**

cd ..

cd ai-backend

npm install

**3\. Configure Environment Variables**

Locate the following .env files and update the IP address to match **your local machine**:

- frontend/.env
- backend/.env

**Important:** Include the http:// prefix and ensure the backend port matches across configurations.

If **port 8080** is already in use, change it in:

| **File Location** | **Variable Name** |
| --- | --- |
| frontend/.env | EXPO_PUBLIC_API_BASE |
| backend/.env | PORT |
| backend/.env | MAIN_BACKEND_URL |

**4\. Run the Project**

Run the following services **simultaneously**:

**Frontend**

cd frontend

npm run start

**Backend**

cd backend

npm start

**AI Backend**

cd ai-backend

npm start

**❗ Troubleshooting**

| **Issue** | **Fix** |
| --- | --- |
| **Network error during login** | Check frontend/.env and ensure correct IP + port format (e.g., <http://192.168.0.10:8080>) |
| **Port already in use** | Update ports in .env files as described above |
| Backend not responding | Ensure all three components are running |

**🔧 IoT Setup**

Refer to the **Readme file inside the /IoT folder** for hardware and firmware configuration instructions.

**☁️ Cloud Deployment**

**Steps:**

- Checkout the cloud branch:
- git checkout aws-branch
- Request the project owner (**Jonathan**) to activate the cloud server.

AWS Educate learner accounts require manual server activation when starting the lab environment.

- Run the frontend locally as usual.
- **Skip the backend step** - backend runs remotely in AWS.
- Contact the AI engineer (**Kelvin**) to deploy the AI backend server.  
    Once deployed, AI features (plant detection, retraining, etc.) will be functional.

**📄 License**

This project is for academic and demonstration purposes. License terms may be updated based on deployment requirements.

**📞 Support / Contacts**

For assistance during setup:

| **Area** | **Contact** |
| --- | --- |
| Cloud backend server | **Jonathan** |
| AI model & AI backend | **Kelvin** |
| General project issues | Any contributing member |