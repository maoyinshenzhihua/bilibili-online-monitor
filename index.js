const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 提供静态文件服务
app.use(express.static(path.join(__dirname, '.')));

// 根路径返回index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 获取视频在线人数的API端点
app.get('/api/online/:bvid', async (req, res) => {
  try {
    const { bvid } = req.params;
    console.log(`Fetching online count for BV: ${bvid}`);
    
    // B站API获取视频信息
    const videoInfoResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view`, {
      params: {
        bvid: bvid
      }
    });
    
    console.log('Video info response:', JSON.stringify(videoInfoResponse.data, null, 2));
    
    // 获取cid
    let cid;
    if (videoInfoResponse.data.data.cid) {
      cid = videoInfoResponse.data.data.cid;
    } else if (videoInfoResponse.data.data.pages && videoInfoResponse.data.data.pages.length > 0) {
      cid = videoInfoResponse.data.data.pages[0].cid;
    } else {
      throw new Error('无法获取视频cid');
    }
    console.log(`Found cid: ${cid}`);
    
    // 使用正确的API端点和参数获取在线人数
    const onlineResponse = await axios.get(`https://api.bilibili.com/x/player/online/total`, {
      params: {
        bvid: bvid,
        cid: cid
      }
    });
    
    console.log('Online response:', JSON.stringify(onlineResponse.data, null, 2));
    
    // 解析响应数据
    let onlineCount = 0;
    let originalOnlineCount = 0;
    if (onlineResponse.data && onlineResponse.data.code === 0 && onlineResponse.data.data) {
      // 优先使用total字段（总在线人数）
      if (onlineResponse.data.data.total) {
        originalOnlineCount = onlineResponse.data.data.total;
        // 尝试将total转换为数字
        if (typeof originalOnlineCount === 'string') {
          // 处理模糊值，如"6"、"9.4万+"、"1000+"等
          onlineCount = parseOnlineCount(originalOnlineCount);
        } else {
          onlineCount = originalOnlineCount;
        }
      } else if (onlineResponse.data.data.count) {
        // 如果没有total，使用count（Web端实时精确人数）
        originalOnlineCount = onlineResponse.data.data.count;
        onlineCount = parseInt(originalOnlineCount) || 0;
      }
    }
    
    // 确保onlineCount是数字类型
    onlineCount = parseInt(onlineCount) || 0;
    // 确保originalOnlineCount有值
    if (!originalOnlineCount) {
      originalOnlineCount = onlineCount.toString();
    }
    
    // 解析在线人数模糊值
    function parseOnlineCount(countStr) {
      // 移除加号
      const cleanStr = countStr.replace(/\+/g, '');
      
      // 处理包含"万"的情况，如"1.4万"
      if (cleanStr.includes('万')) {
        const numPart = cleanStr.replace('万', '');
        const num = parseFloat(numPart);
        if (!isNaN(num)) {
          return Math.round(num * 10000);
        }
      }
      
      // 处理纯数字字符串，如"1000"
      const num = parseInt(cleanStr);
      if (!isNaN(num)) {
        return num;
      }
      
      // 如果无法解析，返回0
      return 0;
    }
    
    const timestamp = new Date().toISOString();
    
    res.json({
      success: true,
      data: {
        onlineCount, // 解析后的数字，用于统计和图表
        originalOnlineCount, // 原始值，用于显示
        timestamp
      }
    });
  } catch (error) {
    console.error('Error fetching online count:', error.message);
    console.error('Error details:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Server can be accessed from external networks at http://your-public-ip:${PORT}`);
});