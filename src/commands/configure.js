const puppeteer = require('puppeteer')
const btoa = require('btoa')

const command = {
  name: 'configure',
  run: async toolbox => {
    const { print, prompt, http, filesystem } = toolbox
    
    const configFilename = `${filesystem.homedir()}${filesystem.separator}.j2c-config`

    if (filesystem.exists(configFilename)) {
      print.info('j2c is already configured on this computer with the following parameters:')

      const { overwriteConfig } = await prompt.ask([
        {
          type: 'confirm',
          name: 'overwriteConfig',
          message: 'Do you want to overwrite the settings?',
          default: false
        },
      ])

      if (!overwriteConfig) {
        return;
      }
    }

    const { jiraUser, jiraPassword } = await prompt.ask([
      {
        type: 'input',
        name: 'jiraUser',
        message: 'What is your Jira user?'
      },
      {
        type: 'password',
        name: 'jiraPassword',
        message: 'What is your Jira password?'
      }
    ])

    const spinnerJiraAuth = print.spin('Jira auth')

    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto('http://jira.bancotopazio.com.br/login.jsp', {
      waitUntil: 'networkidle2'
    })

    await page.type('#login-form-username', jiraUser.trim())
    await page.type('#login-form-password', jiraPassword.trim())
    await page.click('#login-form-submit')

    let jiraLoginSuccess = false
    await page
      .waitForSelector('.aui-message.error', { visible: true, timeout: 2000 })
      .catch(() => {
        jiraLoginSuccess = true
      })

    if (!jiraLoginSuccess) {
      spinnerJiraAuth.fail('Jira Auth failed')
      return
    }

    spinnerJiraAuth.succeed('Jira Auth successful')

    await browser.close()

    const jiraData = { user: jiraUser.trim(), password: jiraPassword.trim() }

    const { clockifyToken } = await prompt.ask([
      {
        type: 'input',
        name: 'clockifyToken',
        message: 'What is your Clockify token?'
      }
    ])

    const api = http.create({
      baseURL: 'https://api.clockify.me/api/v1',
      headers: { 'X-Api-Key': clockifyToken.trim() }
    })

    const spinnerUserData = print.spin('Clockify auth')

    const { ok: clockifyUserOk, data: clockifyUserData } = await api.get(
      '/user'
    )

    if (clockifyUserOk) {
      spinnerUserData.succeed('Clockify auth successful')
    } else {
      spinnerUserData.fail('Clockify auth failed')
      return false
    }

    print.info(`Welcome ${clockifyUserData.name}`)

    const workspace = clockifyUserData.memberships.find(
      m => m.membershipType === 'WORKSPACE' && m.membershipStatus === 'ACTIVE'
    ).targetId

    const spinnerProjects = print.spin('Loading Clockify projects')

    const {
      ok: clockifyProjectsOk,
      data: clockifyProjectsData
    } = await api.get(`/workspaces/${workspace}/projects`)

    if (clockifyProjectsOk) {
      spinnerProjects.succeed('Clockify projects load successful')
    } else {
      spinnerProjects.fail('Clockify projects load failed')
    }

    const clockifyProjects = clockifyProjectsData.filter(p => !p.archived)

    const { clockifyProjectNameDefault } = await prompt.ask([
      {
        type: 'select',
        name: 'clockifyProjectNameDefault',
        message: 'What is default project?',
        choices: [...clockifyProjects.map(p => p.name)]
      }
    ])

    const clockifyProjectDefault = clockifyProjects.find(
      p => p.name === clockifyProjectNameDefault
    ).id

    const spinnerTasks = print.spin('Loading Clockify projects')

    const { ok: clockifyTasksOk, data: clockifyTasksData } = await api.get(
      `/workspaces/${workspace}/projects/${clockifyProjectDefault}/tasks`
    )

    if (clockifyTasksOk) {
      spinnerTasks.succeed('Clockify tasks load successful')
    } else {
      spinnerTasks.fail('Clockify tasks load failed')
    }

    const { clockifyTaskNameDefault } = await prompt.ask([
      {
        type: 'select',
        name: 'clockifyTaskNameDefault',
        message: 'What is default task?',
        choices: [...clockifyTasksData.map(p => p.name)]
      }
    ])

    const clockifyTaskDefault = clockifyTasksData.find(
      p => p.name === clockifyTaskNameDefault
    ).id

    const clockifyData = {
      token: clockifyToken.trim(),
      workspace: workspace.trim(),
      project: clockifyProjectDefault.trim(),
      task: clockifyTaskDefault.trim()
    }

    filesystem.write(
      configFilename,
      btoa(
        JSON.stringify({
          clockify: clockifyData,
          jira: jiraData
        })
      )
    )

    print.success('Config finished')

    return
  }
}

module.exports = command
