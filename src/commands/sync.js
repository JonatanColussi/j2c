const puppeteer = require('puppeteer')
const atob = require('atob')
const {
  set,
  parseISO,
  isEqual,
  isBefore,
  isAfter,
  format
} = require('date-fns')

module.exports = {
  name: 'sync',
  run: async toolbox => {
    const { print, http, filesystem } = toolbox

    const configFilename = `${filesystem.homedir()}${
      filesystem.separator
    }.j2c-config`

    if (!filesystem.exists(configFilename)) {
      print.error('Config not found')
      print.error('Please run "j2c configure"')
      return
    }

    const config = JSON.parse(atob(await filesystem.read(configFilename)))

    const spinnerJiraGetData = print.spin('Get data of Jira')

    const browser = await puppeteer.launch({
      headless: true
    })

    const page = await browser.newPage()
    await page.goto(
      'http://jira.btfinanceira.com.br/login.jsp?permissionViolation=true&os_destination=%2Fsecure%2FCalendarWebAction%21default.jspa&page_caps=&user_role=',
      {
        waitUntil: 'networkidle2'
      }
    )

    await page.type('#login-form-username', config.jira.user)
    await page.type('#login-form-password', config.jira.password)
    await page.click('#login-form-submit')

    page.on('response', async response => {
      if (response.url().includes('worklogs')) {
        const jiraData = await response.json()

        spinnerJiraGetData.succeed('Jira get data successful')

        await browser.close()

        const clockifyApi = http.create({
          baseURL: 'https://api.clockify.me/api/v1',
          headers: { 'X-Api-Key': config.clockify.token }
        })

        let { data: userTimeEntries } = await clockifyApi.get(
          `/workspaces/${config.clockify.workspace}/user/${config.clockify.userId}/time-entries`
        )
        userTimeEntries = userTimeEntries
          .filter(
            t =>
              t.projectId === config.clockify.project &&
              t.taskId === config.clockify.task
          )
          .map(t => {
            t.timeInterval.start = parseISO(t.timeInterval.start)
            t.timeInterval.end = parseISO(t.timeInterval.end)
            return t
          })

        const isBetween = (date, from, to) =>
          (isEqual(from, date) || isBefore(from, date)) &&
          (isEqual(to, date) || isAfter(to, date))

        let countInserted = 0
        const inserteds = []
        const spinnerInsertClockify = print.spin('Insert data on Clockify')
        for (const jiraHour of jiraData) {
          const date = new Date(
            new Date(new Date().getFullYear(), 0).setDate(jiraHour.dayNo)
          )

          const [hoursStart, minutesStart] = jiraHour.startTime
            .split(':')
            .map(t => Number.parseInt(t, 10))
          const [hoursEnd, minutesEnd] = jiraHour.endTime
            .split(':')
            .map(t => Number.parseInt(t, 10))

          const start = set(date, {
            hours: hoursStart,
            minutes: minutesStart,
            seconds: 0
          })

          const end = set(date, {
            hours: hoursEnd,
            minutes: minutesEnd,
            seconds: 0
          })

          if (
            !userTimeEntries.some(t =>
              isBetween(start, t.timeInterval.start, t.timeInterval.end)
            ) &&
            !userTimeEntries.some(t =>
              isBetween(end, t.timeInterval.start, t.timeInterval.end)
            )
          ) {
            const { ok } = await clockifyApi.post(
              `/workspaces/${config.clockify.workspace}/time-entries`,
              {
                start,
                end,
                billable: 'true',
                description: jiraHour.issueSummary,
                projectId: config.clockify.project,
                taskId: config.clockify.task,
                tagIds: []
              }
            )

            if (ok) {
              inserteds.push({
                description: jiraHour.issueSummary,
                date: format(start, 'dd/MM/yyyy'),
                start: format(start, 'kk:mm'),
                end: format(end, 'kk:mm')
              })
              countInserted++
            }
          }
        }

        spinnerInsertClockify.succeed(`${countInserted} times inserted`)
        if (countInserted > 0) {
          print.table(
            [
              Object.keys(inserteds[0]),
              ...inserteds.map(i => Object.values(i))
            ],
            { format: 'markdown' }
          )
        }
      }
    })
  }
}
