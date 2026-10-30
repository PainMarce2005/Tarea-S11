pipeline {
    agent any

    parameters {
        string(
            name: 'PYTHON',
            defaultValue: '',
            description: 'Python executable or path; empty uses python3 on Unix and python on Windows'
        )
        choice(
            name: 'K6_PROFILE',
            choices: ['smoke', 'load', 'stress', 'all'],
            description: 'k6 profile to run; all runs smoke, load, and stress'
        )
    }

    environment {
        BASE_URL = 'http://127.0.0.1:8000'
    }

    stages {
        stage('Install dependencies') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eu
                            python_command="${PYTHON:-python3}"
                            "$python_command" -c "from pathlib import Path; import shutil; [shutil.rmtree(p) for p in ('reports/unittest', 'reports/behave') if Path(p).exists()]"
                            "$python_command" -m pip install -r requirements.txt
                            "$python_command" -c "from pathlib import Path; [Path(p).mkdir(parents=True, exist_ok=True) for p in ('reports/unittest', 'reports/behave')]"
                        '''
                    } else {
                        powershell '''
                            $python = if ($env:PYTHON -and $env:PYTHON.Trim()) {
                                $env:PYTHON
                            } else {
                                'python'
                            }
                            $generatedPaths = @('reports/unittest', 'reports/behave')
                            foreach ($path in $generatedPaths) {
                                if (Test-Path $path) {
                                    Remove-Item -Path $path -Recurse -Force
                                }
                            }
                            & $python -m pip install -r requirements.txt
                            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                            New-Item -ItemType Directory -Force -Path $generatedPaths | Out-Null
                        '''
                    }
                }
            }
        }

        stage('Functional / Unit tests (Selenium)') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    script {
                        if (isUnix()) {
                            sh '''
                                python_command="${PYTHON:-python3}"
                                "$python_command" -m xmlrunner discover -s tests -o reports/unittest
                            '''
                        } else {
                            powershell '''
                                $python = if ($env:PYTHON -and $env:PYTHON.Trim()) {
                                    $env:PYTHON
                                } else {
                                    'python'
                                }
                                & $python -m xmlrunner discover -s tests -o reports/unittest
                                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                            '''
                        }
                    }
                }
            }
        }

        stage('Acceptance tests (Behave)') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    script {
                        if (isUnix()) {
                            sh '''
                                python_command="${PYTHON:-python3}"
                                "$python_command" -m behave features --junit --junit-directory reports/behave
                            '''
                        } else {
                            powershell '''
                                $python = if ($env:PYTHON -and $env:PYTHON.Trim()) {
                                    $env:PYTHON
                                } else {
                                    'python'
                                }
                                & $python -m behave features --junit --junit-directory reports/behave
                                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                            '''
                        }
                    }
                }
            }
        }

        stage('Unit tests (Jest)') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    script {
                        if (isUnix()) {
                            sh '''
                                set -eu
                                rm -rf reports/jest
                                mkdir -p reports/jest
                                npm install --prefix unit_tests --no-audit --no-fund
                                npm test --prefix unit_tests
                            '''
                        } else {
                            powershell '''
                                if (Test-Path 'reports/jest') {
                                    Remove-Item -Path 'reports/jest' -Recurse -Force
                                }
                                New-Item -ItemType Directory -Force -Path 'reports/jest' | Out-Null
                                npm.cmd install --prefix unit_tests --no-audit --no-fund
                                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                                npm.cmd test --prefix unit_tests
                                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                            '''
                        }
                    }
                }
            }
        }

        stage('Non-functional tests (k6)') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    script {
                        def profiles = params.K6_PROFILE == 'all'
                            ? ['smoke', 'load', 'stress']
                            : [params.K6_PROFILE]
                        def unixCommands = profiles.collect { profile ->
                            "k6 run --summary-export=k6/results/${profile}-summary.json k6/${profile}.js"
                        }.join('\n')
                        def windowsCommands = profiles.collect { profile ->
                            """k6 run --summary-export=k6/results/${profile}-summary.json k6/${profile}.js
if (\$LASTEXITCODE -ne 0) {
    throw 'Falló el perfil k6 ${profile}.'
}"""
                        }.join('\n')

                        if (isUnix()) {
                            sh """
                                set -eu
                                rm -rf k6/results
                                mkdir -p k6/results
                                k6 version
                                python_command="\${PYTHON:-python3}"
                                "\$python_command" -m http.server 8000 --directory app --bind 127.0.0.1 >/dev/null 2>&1 &
                                server_pid=\\$!
                                trap 'kill "\\$server_pid" 2>/dev/null || true' EXIT

                                ready=0
                                for attempt in \\$(seq 1 30); do
                                    if ! kill -0 "\\$server_pid" 2>/dev/null; then
                                        echo 'El servidor estático terminó antes de responder.' >&2
                                        exit 1
                                    fi
                                    if curl --fail --silent "\$BASE_URL/tienda_demo.html" >/dev/null; then
                                        ready=1
                                        break
                                    fi
                                    sleep 1
                                done
                                if [ "\\$ready" -ne 1 ]; then
                                    echo 'No se pudo iniciar el servidor estático local.' >&2
                                    exit 1
                                fi

                                ${unixCommands}
                            """
                        } else {
                            powershell """
                                if (Test-Path 'k6/results') {
                                    Remove-Item -Path 'k6/results' -Recurse -Force
                                }
                                New-Item -ItemType Directory -Force -Path 'k6/results' | Out-Null
                                k6 version
                                if (\$LASTEXITCODE -ne 0) {
                                    throw 'k6 no está instalado o no está disponible en PATH.'
                                }

                                \$python = if (\$env:PYTHON -and \$env:PYTHON.Trim()) {
                                    \$env:PYTHON
                                } else {
                                    'python'
                                }
                                \$server = Start-Process -FilePath \$python `
                                    -ArgumentList @('-m', 'http.server', '8000', '--directory', 'app', '--bind', '127.0.0.1') `
                                    -WorkingDirectory (Get-Location).Path `
                                    -PassThru -WindowStyle Hidden
                                try {
                                    \$ready = \$false
                                    for (\$attempt = 0; \$attempt -lt 30; \$attempt++) {
                                        \$server.Refresh()
                                        if (\$server.HasExited) {
                                            throw 'El servidor estático terminó antes de responder.'
                                        }
                                        try {
                                            \$response = Invoke-WebRequest -UseBasicParsing `
                                                -Uri "\$env:BASE_URL/tienda_demo.html" -TimeoutSec 2
                                            if (\$response.StatusCode -eq 200) {
                                                \$ready = \$true
                                                break
                                            }
                                        } catch {
                                            Start-Sleep -Seconds 1
                                        }
                                    }
                                    if (-not \$ready) {
                                        throw 'No se pudo iniciar el servidor estático local.'
                                    }

                                    ${windowsCommands}
                                } finally {
                                    Stop-Process -Id \$server.Id -Force -ErrorAction SilentlyContinue
                                }
                            """
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            junit testResults: 'reports/**/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'k6/results/*-summary.json', allowEmptyArchive: true
        }
    }
}
