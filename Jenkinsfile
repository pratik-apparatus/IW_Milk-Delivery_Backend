pipeline {
    agent any

    environment {
        CONTAINER_PORT = '6025'
        MS_PORT = '4012'
        IMAGE_NAME = 'milk-delivery-backend'
        NETWORK_NAME = 'milk-delivery-services'
        REDIS_CONTAINER_NAME = 'milk-delivery-redis'
        REDIS_HOST_PORT = '6380'
        REDIS_CONTAINER_PORT = '6379'
        SERVICE_ALIAS = 'backend.milk-delivery'
    }

    stages {
        stage('Set Environment Profile') {
            steps {
                script {
                    def prodBranches = ['main', 'master']
                    if (prodBranches.contains(env.BRANCH_NAME)) {
                        env.NODE_ENV = 'production'
                        env.ENV_CREDENTIAL_ID = 'milk_delivery_backend_env'
                    } else {
                        env.NODE_ENV = 'development'
                        env.ENV_CREDENTIAL_ID = 'milk_delivery_backend_env_dev'
                    }
                    echo "Branch: ${env.BRANCH_NAME} → NODE_ENV=${env.NODE_ENV}, credential=${env.ENV_CREDENTIAL_ID}"
                }
            }
        }

        stage('Set Port and Container Name') {
            steps {
                script {
                    env.HOST_PORT = '6025'
                    env.CONTAINER_NAME = "milk-delivery-backend-${env.BRANCH_NAME}"
                }
            }
        }

        stage('Load Environment Variables') {
            steps {
                withCredentials([file(credentialsId: "${ENV_CREDENTIAL_ID}", variable: 'ENV_FILE')]) {
                    sh '''
                        echo "Sanitizing env file for build..."
                        tr -d '\\r' < "$ENV_FILE" | sed 's/"//g' | sed "s/'//g" > .env
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    docker run --rm -v ${WORKSPACE}:/app -w /app node:20-alpine sh -c \
                      "npm ci"
                '''
            }
        }

        stage('Build') {
            steps {
                withCredentials([file(credentialsId: "${ENV_CREDENTIAL_ID}", variable: 'ENV_FILE')]) {
                    sh '''
                        echo "Writing .env for build..."
                        tr -d '\\r' < "$ENV_FILE" | sed 's/"//g' | sed "s/'//g" > .env
                        docker run --rm -v ${WORKSPACE}:/app -w /app node:20-alpine sh -c \
                          "npm run build"
                    '''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                withCredentials([file(credentialsId: "${ENV_CREDENTIAL_ID}", variable: 'ENV_FILE')]) {
                    sh '''
                        echo "Writing .env for Docker build context..."
                        tr -d '\\r' < "$ENV_FILE" | sed 's/"//g' | sed "s/'//g" > .env
                        docker build -t ${IMAGE_NAME}:"$BRANCH_NAME" -f Dockerfile .
                    '''
                }
            }
        }

        stage('Create Shared Network') {
            steps {
                sh '''
                    docker network create "$NETWORK_NAME" || true
                '''
            }
        }

        stage('Ensure Redis') {
            steps {
                sh '''
                    if [ "$(docker ps -aq -f name=^${REDIS_CONTAINER_NAME}$)" ]; then
                        echo "Redis container exists. Starting and attaching to network..."
                        docker start "${REDIS_CONTAINER_NAME}" || true
                        docker network connect --alias redis "$NETWORK_NAME" "${REDIS_CONTAINER_NAME}" || true
                    else
                        echo "Creating Redis container..."
                        docker run -d \
                            --name "${REDIS_CONTAINER_NAME}" \
                            --network "$NETWORK_NAME" \
                            --network-alias redis \
                            -p "${REDIS_HOST_PORT}:${REDIS_CONTAINER_PORT}" \
                            --restart always \
                            redis:7
                    fi
                '''
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: "${ENV_CREDENTIAL_ID}", variable: 'ENV_FILE')]) {
                    sh '''
                        echo "Stopping old container..."
                        docker rm -f "$CONTAINER_NAME" || true

                        echo "Sanitizing env file for Docker..."
                        tr -d '\\r' < "$ENV_FILE" | sed 's/"//g' | sed "s/'//g" > .env.runtime

                        echo "Starting new container..."
                        docker run -d \
                            --name "$CONTAINER_NAME" \
                            --network "$NETWORK_NAME" \
                            --network-alias ${SERVICE_ALIAS} \
                            -p "$HOST_PORT:$CONTAINER_PORT" \
                            -e NODE_ENV="$NODE_ENV" \
                            -e PORT="$CONTAINER_PORT" \
                            -e MS_HOST="0.0.0.0" \
                            -e MS_PORT="$MS_PORT" \
                            -e MAIL_MS_HOST="mail.milk-delivery" \
                            -e MAIL_MS_PORT="4003" \
                            -e REDIS_HOST="${REDIS_CONTAINER_NAME}" \
                            -e REDIS_PORT="${REDIS_CONTAINER_PORT}" \
                            -e REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
                            --env-file .env.runtime \
                            --restart always \
                            ${IMAGE_NAME}:"$BRANCH_NAME"
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "Waiting for service to be healthy..."
                    sleep(time: 15, unit: 'SECONDS')

                    def status = sh(
                        script: "docker ps --filter name=${CONTAINER_NAME} --format '{{.Status}}'",
                        returnStdout: true
                    ).trim()

                    if (!status) {
                        error("Container ${CONTAINER_NAME} failed to start")
                    }

                    echo "Container status: ${status}"

                    def healthCheck = sh(
                        script: "curl -sf http://localhost:${HOST_PORT}/health",
                        returnStatus: true
                    )

                    if (healthCheck != 0) {
                        sh "docker logs ${CONTAINER_NAME}"
                        error("Health check failed for ${CONTAINER_NAME}")
                    }

                    echo "Health check passed"
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline execution completed for branch: ${env.BRANCH_NAME}"
        }
        failure {
            echo "Pipeline failed. Showing container logs..."
            script {
                if (env.CONTAINER_NAME) {
                    sh 'docker logs "$CONTAINER_NAME" || true'
                }
            }
        }
    }
}
