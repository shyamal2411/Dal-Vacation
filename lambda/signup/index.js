import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import axios from "axios";
import bcrypt from "bcryptjs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new CognitoIdentityProviderClient({
  region: process.env.REGION,
});

const DBclient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(DBclient);

export const handler = async (event) => {
  const { username, password, email, firstName, lastName, role } = JSON.parse(
    event.body
  );

  if (!username || !password || !email || !firstName || !lastName) {
    return {
      statusCode: 400,
      body: "Missing required user details",
    };
  }
  const signupDate = new Date().toISOString();

  const saltRounds = 2;
  const hashedPassword = await bcrypt.hashSync(password, saltRounds);

  const signUpParams = {
    ClientId: process.env.CLIENT_ID,
    Username: username,
    Password: password,
    UserAttributes: [
      {
        Name: "email",
        Value: email,
      },
      {
        Name: "given_name",
        Value: firstName,
      },
      {
        Name: "family_name",
        Value: lastName,
      },
      {
        Name: "custom:role",
        Value: role,
      },
      {
        Name: "custom:signupDate",
        Value: signupDate,
      },
    ],
  };

  const DynamoDBparams = {
    TableName: "UserData",
    Item: {
      username: username,
      email: email,
      firstName: firstName,
      lastName: lastName,
      password: hashedPassword,
      role: role,
      signupDate: signupDate,
    },
  };

  try {
    const command = new SignUpCommand(signUpParams);
    await client.send(command);
    const DBcommand = new PutCommand(DynamoDBparams);
    await ddbDocClient.send(DBcommand);

    try {
      const response = await axios.post(
        process.env.SIGNUP_NOTIFICATION_LAMBDA_URL,
        {
          email: email,
        }
      );
      console.log("SNS TOPIC  RESP SIGNUP**** " + response.data);
    } catch (e) {
      console.log("SIGNUP NOTIFICATION ERROR ", e);
    }

    return {
      statusCode: 200,
      body: "User registered!",
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: err.message,
    };
  }
};
